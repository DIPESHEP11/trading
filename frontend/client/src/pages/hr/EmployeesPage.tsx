import React, { useState, useEffect, useRef } from 'react';
import { hrApi } from '@/api/hrApi';
import { useAuthStore } from '@/store/authStore';
import { restrictTo10Digits } from '@/utils/phone';
import type { Employee, EmployeeDocument, EmployeeCustomField } from '@/types';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = ['', 'male', 'female', 'other'];
const GENDER_LABELS: Record<string, string> = { '': '— Select —', male: 'Male', female: 'Female', other: 'Other' };
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DOC_CATEGORIES: { value: string; label: string }[] = [
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'education', label: 'Education' },
  { value: 'experience', label: 'Experience' },
  { value: 'other', label: 'Other' },
];

const ROLE_OPTIONS = [
  { value: 'member', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

const SECTION_OPTIONS: { value: EmployeeCustomField['section']; label: string }[] = [
  { value: 'basic', label: 'Basic Info' },
  { value: 'personal', label: 'Personal' },
  { value: 'experience', label: 'Experience' },
  { value: 'education', label: 'Education' },
  { value: 'official', label: 'Official / Company' },
];

const TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'company', label: 'Company' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'documents', label: 'Documents' },
  { id: 'additional', label: 'Additional' },
];

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  date_of_birth: '', gender: '', blood_group: '',
  address: '', home_phone: '', reference_phone: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  employee_id: '', department: '', designation: '',
  role: 'member', join_date: new Date().toISOString().split('T')[0],
  salary: '', experience_details: '', education_details: '',
  description: '', resigned: false, resign_date: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v?: string | null) => v || '—';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'super_admin';

  // List state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Custom fields state
  const [customFields, setCustomFields] = useState<EmployeeCustomField[]>([]);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfNewName, setCfNewName] = useState('');
  const [cfNewSection, setCfNewSection] = useState<EmployeeCustomField['section']>('basic');
  const [cfSaving, setCfSaving] = useState(false);

  // View popup
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [sendingResetLink, setSendingResetLink] = useState(false);

  // Add / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [customValues, setCustomValues] = useState<Record<number, string>>({});

  // Send reset link loading
  const [sendingResetLinkId, setSendingResetLinkId] = useState<number | null>(null);

  // Documents
  const [existingDocs, setExistingDocs] = useState<EmployeeDocument[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (search) params.search = search;
      if (statusFilter === 'active') params.resigned = false;
      if (statusFilter === 'resigned') params.resigned = true;
      const res = await hrApi.employees.list(params);
      const d = (res as unknown as { data: { employees: Employee[] } }).data;
      setEmployees(d?.employees || []);
    } catch {
      toast.error('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const res = await hrApi.customFields.list();
      setCustomFields((res as unknown as { data: EmployeeCustomField[] }).data || []);
    } catch { /* non-critical */ }
  };

  useEffect(() => { fetchEmployees(); }, [statusFilter]);
  useEffect(() => { fetchCustomFields(); }, []);

  // ─── Open add / edit modal ───────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setCustomValues({});
    setExistingDocs([]);
    setActiveTab('basic');
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      date_of_birth: emp.date_of_birth || '',
      gender: emp.gender || '',
      blood_group: emp.blood_group || '',
      address: emp.address || '',
      home_phone: emp.home_phone || '',
      reference_phone: emp.reference_phone || '',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',
      employee_id: emp.employee_id || '',
      department: emp.department || '',
      designation: emp.designation || '',
      role: emp.role || 'member',
      join_date: emp.join_date || '',
      salary: emp.salary || '',
      experience_details: emp.experience_details || '',
      education_details: emp.education_details || '',
      description: emp.description || '',
      resigned: emp.resigned || false,
      resign_date: emp.resign_date || '',
    });
    const cvMap: Record<number, string> = {};
    emp.custom_values?.forEach((cv) => { cvMap[cv.field_id] = cv.value; });
    setCustomValues(cvMap);
    setExistingDocs(emp.documents || []);
    setActiveTab('basic');
    setModalOpen(true);
  };

  // ─── Save employee ──────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) { toast.error('First name is required.'); setActiveTab('basic'); return; }
    if (!form.email.trim()) { toast.error('Email is required.'); setActiveTab('basic'); return; }
    if (!form.employee_id.trim()) { toast.error('Employee ID is required.'); setActiveTab('company'); return; }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, phone: form.phone,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender, blood_group: form.blood_group,
        address: form.address, home_phone: form.home_phone,
        reference_phone: form.reference_phone,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        employee_id: form.employee_id, department: form.department,
        designation: form.designation, role: form.role,
        join_date: form.join_date || null,
        salary: form.salary || null,
        experience_details: form.experience_details,
        education_details: form.education_details,
        description: form.description,
        resigned: form.resigned,
        resign_date: form.resign_date || null,
        custom_values: Object.entries(customValues).map(([field_id, value]) => ({
          field_id: Number(field_id), value,
        })),
      };

      let savedId: number;
      if (editing) {
        await hrApi.employees.update(editing.id, payload);
        savedId = editing.id;
        toast.success('Employee updated.');
      } else {
        const res = await hrApi.employees.create(payload);
        const d = (res as unknown as { data: Employee }).data;
        savedId = d.id;
        toast.success('Employee added.');
      }

      // Upload queued document if any
      if (docFile && docTitle) {
        const fd = new FormData();
        fd.append('title', docTitle);
        fd.append('category', docCategory);
        fd.append('file', docFile);
        await hrApi.documents.upload(savedId, fd);
        setDocTitle(''); setDocCategory('other'); setDocFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      setModalOpen(false);
      fetchEmployees();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to save employee.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete employee ─────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this employee? This will also remove their login account.')) return;
    try {
      await hrApi.employees.delete(id);
      toast.success('Employee deleted.');
      fetchEmployees();
    } catch {
      toast.error('Failed to delete employee.');
    }
  };

  // ─── Delete document ─────────────────────────────────────────────────────────

  const handleDeleteDoc = async (docId: number) => {
    setDeletingDocId(docId);
    try {
      await hrApi.documents.delete(docId);
      setExistingDocs((d) => d.filter((x) => x.id !== docId));
      toast.success('Document deleted.');
    } catch {
      toast.error('Failed to delete document.');
    } finally {
      setDeletingDocId(null);
    }
  };

  // ─── Upload document immediately (in edit mode) ───────────────────────────

  const handleUploadDoc = async () => {
    if (!docFile) { toast.error('Please select a file.'); return; }
    if (!docTitle.trim()) { toast.error('Please enter a document title.'); return; }
    if (!editing) {
      toast('Document will be uploaded when you save the employee.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', docTitle);
      fd.append('category', docCategory);
      fd.append('file', docFile);
      const res = await hrApi.documents.upload(editing.id, fd);
      const d = (res as unknown as { data: EmployeeDocument }).data;
      setExistingDocs((prev) => [...prev, d]);
      setDocTitle(''); setDocCategory('other'); setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Document uploaded.');
    } catch {
      toast.error('Failed to upload document.');
    }
  };

  // ─── Custom field CRUD ───────────────────────────────────────────────────────

  const handleAddCustomField = async () => {
    if (!cfNewName.trim()) { toast.error('Field name is required.'); return; }
    setCfSaving(true);
    try {
      await hrApi.customFields.create({ name: cfNewName.trim(), section: cfNewSection });
      toast.success('Custom field added.');
      setCfNewName(''); setCfNewSection('basic');
      fetchCustomFields();
    } catch {
      toast.error('Failed to add field.');
    } finally {
      setCfSaving(false);
    }
  };

  const handleDeleteCustomField = async (id: number) => {
    if (!window.confirm('Delete this custom field? Existing values will be lost.')) return;
    try {
      await hrApi.customFields.delete(id);
      toast.success('Custom field deleted.');
      fetchCustomFields();
    } catch {
      toast.error('Failed to delete field.');
    }
  };

  // ─── Group custom fields by section ──────────────────────────────────────────

  const cfBySection = customFields.reduce((acc, cf) => {
    if (!acc[cf.section]) acc[cf.section] = [];
    acc[cf.section].push(cf);
    return acc;
  }, {} as Record<string, EmployeeCustomField[]>);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Employees</h1>
            <p className="page-subtitle">Manage your company workforce — add, edit, view employee details.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isAdmin && (
              <button className="btn btn-secondary" onClick={() => setCfModalOpen(true)}>
                Custom Fields
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-primary" onClick={openAdd}>
                + Add Employee
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" className="form-input" placeholder="Search by name, email, ID..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchEmployees()}
            style={{ flex: '1 1 200px', maxWidth: 300 }}
          />
          <select className="form-select" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="resigned">Resigned</option>
          </select>
          <button className="btn btn-primary" onClick={fetchEmployees}>Search</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Employees ({employees.length})</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No employees found. {isAdmin && 'Click "+ Add Employee" to get started.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Join Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
                  return (
                    <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => setViewEmployee(emp)}>
                      <td>
                        <strong>{fullName}</strong>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{emp.email}</div>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{emp.employee_id}</td>
                      <td>{emp.department || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                      <td>{emp.designation || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{fmt(emp.join_date)}</td>
                      <td>
                        <span className={`badge ${emp.resigned ? 'badge-danger' : 'badge-success'}`}>
                          {emp.resigned ? 'Resigned' : 'Active'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setViewEmployee(emp)}>View</button>
                          {isAdmin && (
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>Edit</button>
                          )}
                          {isAdmin && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(emp.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── View employee popup ──────────────────────────────────────────────── */}
      {viewEmployee && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setViewEmployee(null)}
        >
          <div className="card" style={{ maxWidth: 600, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Employee details</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => { setViewEmployee(null); openEdit(viewEmployee); }}>Edit</button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={sendingResetLinkId === viewEmployee.id}
                      onClick={async () => {
                        setSendingResetLinkId(viewEmployee.id);
                        try {
                          await hrApi.employees.sendResetLink(viewEmployee.id);
                          toast.success(`Password reset link sent to ${viewEmployee.email}.`);
                        } catch (err: unknown) {
                          const ex = err as { response?: { data?: Record<string, unknown> } };
                          const d = ex?.response?.data;
                          const msg = (typeof d?.message === 'string' ? d.message : null)
                            ?? (Array.isArray(d?.code) ? d.code[0] : null)
                            ?? (d && typeof d === 'object' ? (Object.values(d)[0] as string[])?.[0] : null);
                          toast.error(msg || 'Failed to send reset link.');
                        } finally {
                          setSendingResetLinkId(null);
                        }
                      }}
                    >
                      {sendingResetLinkId === viewEmployee.id ? <span className="spinner" /> : 'Send reset link'}
                    </button>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setViewEmployee(null)}>Close</button>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Basic */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Basic Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Full name</span><br /><strong>{`${viewEmployee.first_name || ''} ${viewEmployee.last_name || ''}`.trim() || '—'}</strong></div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Email</span><br />{fmt(viewEmployee.email)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Phone</span><br />{fmt(viewEmployee.phone)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Date of birth</span><br />{fmt(viewEmployee.date_of_birth)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Gender</span><br />{GENDER_LABELS[viewEmployee.gender] || '—'}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Blood group</span><br />{fmt(viewEmployee.blood_group)}</div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Address</span><br />{fmt(viewEmployee.address)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Home phone</span><br />{fmt(viewEmployee.home_phone)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Reference phone</span><br />{fmt(viewEmployee.reference_phone)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Emergency contact</span><br />{fmt(viewEmployee.emergency_contact_name)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Emergency phone</span><br />{fmt(viewEmployee.emergency_contact_phone)}</div>
                  </div>
                </div>

                <hr style={{ margin: '4px 0' }} />

                {/* Company */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Company Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Employee ID</span><br /><strong style={{ fontFamily: 'monospace' }}>{viewEmployee.employee_id}</strong></div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Department</span><br />{fmt(viewEmployee.department)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Designation</span><br />{fmt(viewEmployee.designation)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Role</span><br />{ROLE_OPTIONS.find((r) => r.value === viewEmployee.role)?.label || viewEmployee.role}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Join date</span><br />{fmt(viewEmployee.join_date)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Salary</span><br />{viewEmployee.salary ? `₹${Number(viewEmployee.salary).toLocaleString()}` : '—'}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tenure</span><br />{fmt(viewEmployee.tenure)}</div>
                    <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Status</span><br /><span className={`badge ${viewEmployee.resigned ? 'badge-danger' : 'badge-success'}`}>{viewEmployee.resigned ? 'Resigned' : 'Active'}</span></div>
                    {viewEmployee.resigned && (
                      <div><span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Resign date</span><br />{fmt(viewEmployee.resign_date)}</div>
                    )}
                  </div>
                </div>

                {/* Experience */}
                {viewEmployee.experience_details && (
                  <>
                    <hr style={{ margin: '4px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experience</div>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{viewEmployee.experience_details}</p>
                    </div>
                  </>
                )}

                {/* Education */}
                {viewEmployee.education_details && (
                  <>
                    <hr style={{ margin: '4px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Education</div>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{viewEmployee.education_details}</p>
                    </div>
                  </>
                )}

                {/* Documents */}
                {viewEmployee.documents?.length > 0 && (
                  <>
                    <hr style={{ margin: '4px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documents</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {viewEmployee.documents.map((doc) => (
                          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                            <div>
                              <strong style={{ fontSize: 13 }}>{doc.title}</strong>
                              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                                {DOC_CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                              </span>
                            </div>
                            {doc.file_url && (
                              <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Download</a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Custom fields */}
                {viewEmployee.custom_values?.length > 0 && (
                  <>
                    <hr style={{ margin: '4px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Details</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {viewEmployee.custom_values.map((cv) => (
                          <div key={cv.id}>
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{cv.field_name}</span>
                            <br />{cv.value || '—'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Remarks */}
                {viewEmployee.description && (
                  <>
                    <hr style={{ margin: '4px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remarks</div>
                      <p style={{ margin: 0, fontSize: 14 }}>{viewEmployee.description}</p>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add / Edit employee modal ────────────────────────────────────────── */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <div className="card" style={{ maxWidth: 600, maxHeight: '92vh', overflow: 'hidden', width: '100%', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 className="card-title">{editing ? 'Edit employee' : 'Add employee'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => !saving && setModalOpen(false)}>Close</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0, overflowX: 'auto' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: 'none',
                    border: 'none',
                    borderBottomWidth: 2,
                    borderBottomStyle: 'solid',
                    borderBottomColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto' }}>
              <div className="card-body">

                {/* ── Basic Info ─────────────────────────────── */}
                {activeTab === 'basic' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">First name *</label>
                        <input className="form-input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="John" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last name</label>
                        <input className="form-input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Doe" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email *</label>
                        <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!!editing} placeholder="john@example.com" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: restrictTo10Digits(e.target.value) }))} placeholder="9876543210" maxLength={10} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date of birth</label>
                        <input className="form-input" type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Gender</label>
                        <select className="form-select" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                          {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Blood group</label>
                        <select className="form-select" value={form.blood_group} onChange={(e) => setForm((f) => ({ ...f, blood_group: e.target.value }))}>
                          {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b || '— Select —'}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Home phone</label>
                        <input className="form-input" type="tel" value={form.home_phone} onChange={(e) => setForm((f) => ({ ...f, home_phone: restrictTo10Digits(e.target.value) }))} placeholder="9876543210" maxLength={10} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Emergency contact name</label>
                        <input className="form-input" value={form.emergency_contact_name} onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Emergency contact phone</label>
                        <input className="form-input" type="tel" value={form.emergency_contact_phone} onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: restrictTo10Digits(e.target.value) }))} placeholder="9876543210" maxLength={10} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <textarea className="form-textarea" rows={3} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reference phone</label>
                      <input className="form-input" type="tel" value={form.reference_phone} onChange={(e) => setForm((f) => ({ ...f, reference_phone: restrictTo10Digits(e.target.value) }))} placeholder="9876543210" maxLength={10} />
                    </div>
                  </>
                )}

                {/* ── Company ───────────────────────────────── */}
                {activeTab === 'company' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Employee ID *</label>
                        <input className="form-input" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder="EMP-0001" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Role</label>
                        <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Department</label>
                        <input className="form-input" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Engineering" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Designation</label>
                        <input className="form-input" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Developer" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Join date</label>
                        <input className="form-input" type="date" value={form.join_date} onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Salary (₹)</label>
                        <input className="form-input" type="number" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} placeholder="50000" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Remarks / Description</label>
                      <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional notes about role or additional info" />
                    </div>
                    {editing && (
                      <div style={{ padding: 16, border: '1px solid var(--color-danger, #ef4444)', borderRadius: 8, marginTop: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--color-danger, #ef4444)' }}>Resignation</div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" id="resigned" checked={form.resigned} onChange={(e) => setForm((f) => ({ ...f, resigned: e.target.checked }))} />
                          <label htmlFor="resigned" style={{ cursor: 'pointer', fontSize: 14 }}>Mark as resigned</label>
                        </div>
                        {form.resigned && (
                          <div className="form-group">
                            <label className="form-label">Resignation date</label>
                            <input className="form-input" type="date" value={form.resign_date} onChange={(e) => setForm((f) => ({ ...f, resign_date: e.target.value }))} style={{ maxWidth: 200 }} />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── Experience ────────────────────────────── */}
                {activeTab === 'experience' && (
                  <div className="form-group">
                    <label className="form-label">Experience details</label>
                    <textarea
                      className="form-textarea" rows={12}
                      value={form.experience_details}
                      onChange={(e) => setForm((f) => ({ ...f, experience_details: e.target.value }))}
                      placeholder="Describe past work experience, companies, roles, duration..."
                    />
                  </div>
                )}

                {/* ── Education ─────────────────────────────── */}
                {activeTab === 'education' && (
                  <div className="form-group">
                    <label className="form-label">Education details</label>
                    <textarea
                      className="form-textarea" rows={12}
                      value={form.education_details}
                      onChange={(e) => setForm((f) => ({ ...f, education_details: e.target.value }))}
                      placeholder="List degrees, certifications, institutions, years..."
                    />
                  </div>
                )}

                {/* ── Documents ─────────────────────────────── */}
                {activeTab === 'documents' && (
                  <>
                    {/* Existing documents */}
                    {existingDocs.length > 0 && (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: 10 }}>Uploaded documents</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                          {existingDocs.map((doc) => (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                              <div>
                                <strong style={{ fontSize: 13 }}>{doc.title}</strong>
                                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                                  {DOC_CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {doc.file_url && (
                                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  disabled={deletingDocId === doc.id}
                                  onClick={() => handleDeleteDoc(doc.id)}
                                >
                                  {deletingDocId === doc.id ? '...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Upload new document */}
                    <div style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 12 }}>
                        {editing ? 'Upload document' : 'Upload document (after save)'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Title</label>
                          <input className="form-input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Aadhaar Card" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Category</label>
                          <select className="form-select" value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                            {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">File</label>
                        <input ref={fileInputRef} type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                      </div>
                      {editing && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleUploadDoc}>
                          Upload now
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* ── Additional ────────────────────────────── */}
                {activeTab === 'additional' && (
                  <>
                    {Object.keys(cfBySection).length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', padding: '20px 0' }}>
                        No custom fields defined. Go to "Custom Fields" to add fields.
                      </p>
                    ) : (
                      Object.entries(cfBySection).map(([section, fields]) => (
                        <div key={section} style={{ marginBottom: 20 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                            {SECTION_OPTIONS.find((s) => s.value === section)?.label || section}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {fields.map((cf) => (
                              <div className="form-group" key={cf.id} style={{ margin: 0 }}>
                                <label className="form-label">{cf.name}</label>
                                <input
                                  className="form-input"
                                  value={customValues[cf.id] || ''}
                                  onChange={(e) => setCustomValues((p) => ({ ...p, [cf.id]: e.target.value }))}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

              </div>

              {/* Footer */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, background: 'var(--color-bg, #fff)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Add employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Custom Fields modal ──────────────────────────────────────────────── */}
      {cfModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setCfModalOpen(false)}
        >
          <div className="card" style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto', width: '100%' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Custom Fields</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setCfModalOpen(false)}>Close</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Define extra fields that appear in the employee form under "Additional" tab.
              </p>

              {/* Add new field */}
              <div style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Add new field</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Field name</label>
                    <input className="form-input" value={cfNewName} onChange={(e) => setCfNewName(e.target.value)} placeholder="e.g. Passport No" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Section</label>
                    <select className="form-select" value={cfNewSection} onChange={(e) => setCfNewSection(e.target.value as EmployeeCustomField['section'])}>
                      {SECTION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm" disabled={cfSaving} onClick={handleAddCustomField}>
                    {cfSaving ? 'Adding...' : '+ Add field'}
                  </button>
                </div>
              </div>

              {/* Existing fields */}
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Existing fields ({customFields.length})</div>
              {customFields.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>No custom fields yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customFields.map((cf) => (
                    <div key={cf.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{cf.name}</strong>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                          {SECTION_OPTIONS.find((s) => s.value === cf.section)?.label || cf.section}
                        </span>
                      </div>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteCustomField(cf.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
