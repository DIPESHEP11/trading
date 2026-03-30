# 6. Flutter Dynamic Module Architecture

The Trading Mobile App is a single codebase built with **Flutter**. It is distributed to the App Store and Google Play as a universal app. Once a user logs in, the app morphs its UI to fit their company's configured modules.

## How the Mobile App Knows What to Show

1. **Login Event**: 
   The user enters their Company Subdomain (e.g., `oriol`), Email, and Password.
2. **API Handshake**:
   The app calls `https://oriol.trading.com/api/v1/auth/login/` and subsequently `/api/v1/auth/me/`.
3. **The Payload**:
   The API returns not just the User Profile and JWT, but the **Tenant Configuration Object**.

```json
{
  "user": {
    "name": "Jane Doe",
    "role": "Sales Executive"
  },
  "tenant": {
    "name": "Oriol Medical",
    "theme_color": "#2C60D5",
    "active_modules": ["crm", "inventory", "dispatch"]
  }
}
```

## Dynamic UI Construction

### 1. Theme and Branding
Flutter reads the `theme_color` from the JSON and statically applies it to the `MaterialApp` theme data. Buttons, AppBars, and active tab indicators immediately switch to the client's corporate color.

### 2. The Bottom Navigation Bar
Instead of hardcoding a 4-tab bar, Flutter uses a `List<BottomNavigationBarItem>` that is populated dynamically.

```dart
List<BottomNavigationBarItem> buildNav() {
  var items = <BottomNavigationBarItem>[];
  if (modules.contains('crm')) {
    items.add(BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Leads'));
  }
  if (modules.contains('inventory')) {
    items.add(BottomNavigationBarItem(icon: Icon(Icons.inventory), label: 'Stock'));
  }
  return items;
}
```

### 3. Dashboard Widgets
The main Home Screen (`DashboardPage`) uses a GridView of summary cards. The cards are fed by a widget factory pattern that checks the `active_modules` array.
- If `warehouse` is false, hide the "Stock Movement" chart.
- If `manufacturing` is true, show the "Pending Build Orders" badge.

## Benefits of this Architecture

1. **One App Store Listing**: No need to submit 50 different apps to Apple/Google for 50 different clients.
2. **Immediate Updates**: When the Super Admin enables a new module for a client, the client's mobile app users see the new features the next time they open the app.
3. **Smaller Payload Execution**: Although the codebase contains code for modules the client doesn't use, Flutter's memory footprint is optimized because those Route/Widget trees are never instantiated.
