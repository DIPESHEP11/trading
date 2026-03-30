import secrets
from datetime import timedelta

from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.password_validation import validate_password

from apps.users.models import User, PasswordResetToken
from apps.core.responses import success_response, error_response
from .serializers import RegisterSerializer, UserSerializer, ChangePasswordSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/"""
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = _get_tokens(user)
        return success_response(
            data={**UserSerializer(user).data, **tokens},
            message='Registration successful.',
            http_status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """POST /api/v1/auth/login/"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        password = request.data.get('password', '')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return error_response('Invalid credentials.', http_status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return error_response('Invalid credentials.', http_status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return error_response('Account is inactive.', http_status=status.HTTP_403_FORBIDDEN)

        return success_response(
            data={**UserSerializer(user).data, **_get_tokens(user)},
            message='Login successful.',
        )


class LogoutView(APIView):
    """POST /api/v1/auth/logout/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data['refresh']).blacklist()
            return success_response(message='Logged out successfully.')
        except Exception:
            return error_response('Invalid or expired token.')


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=UserSerializer(request.user).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        serializer = self.get_serializer(request.user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Profile updated.')


class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return error_response('Old password is incorrect.')
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return success_response(message='Password changed successfully.')


def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    # Embed tenant context into JWT so frontend and backend can verify it
    refresh['user_role'] = user.role
    refresh['tenant_schema'] = user.tenant.schema_name if user.tenant else 'public'
    refresh['tenant_id'] = user.tenant_id if user.tenant_id else None
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/
    Body: { email }
    Sends a reset link to the email if user exists. Always returns success (no email enumeration).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').lower().strip()
        if not email:
            return error_response('Email is required.', http_status=status.HTTP_400_BAD_REQUEST)

        from django_tenants.utils import schema_context
        with schema_context('public'):
            try:
                user = User.objects.get(email=email, is_active=True)
            except User.DoesNotExist:
                return success_response(message='If that email exists, a reset link has been sent.')

            # Invalidate any existing tokens for this user
            PasswordResetToken.objects.filter(user=user).delete()

            token = secrets.token_urlsafe(48)
            expires_at = timezone.now() + timedelta(hours=24)
            PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

        frontend_url = getattr(django_settings, 'FRONTEND_CLIENT_URL', 'http://localhost:5174')
        reset_link = f'{frontend_url.rstrip("/")}/reset-password?token={token}'

        subject = 'Reset your password'
        message = f'''Hi {user.first_name or user.email},

You requested a password reset. Click the link below to set a new password:

{reset_link}

This link expires in 24 hours. If you didn't request this, ignore this email.
'''
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@trading.local'),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            with schema_context('public'):
                PasswordResetToken.objects.filter(user=user, token=token).delete()
            return error_response('Failed to send email. Please try again later.', http_status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(message='If that email exists, a reset link has been sent.')


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset-confirm/
    Body: { token, new_password }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        new_password = request.data.get('new_password')

        if not token:
            return error_response('Token is required.', http_status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return error_response('New password is required.', http_status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password)
        except Exception as e:
            return error_response(str(list(e.messages)[0]) if hasattr(e, 'messages') else 'Invalid password.', http_status=status.HTTP_400_BAD_REQUEST)

        from django_tenants.utils import schema_context

        with schema_context('public'):
            try:
                prt = PasswordResetToken.objects.select_related('user').get(token=token)
            except PasswordResetToken.DoesNotExist:
                return error_response('Invalid or expired reset link.', http_status=status.HTTP_400_BAD_REQUEST)

            if timezone.now() > prt.expires_at:
                prt.delete()
                return error_response('Reset link has expired. Please request a new one.', http_status=status.HTTP_400_BAD_REQUEST)

            user = prt.user
            user.set_password(new_password)
            user.save()
            prt.delete()

        return success_response(message='Password has been reset. You can now log in.')
