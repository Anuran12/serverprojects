# Frontend Architecture & UI Documentation
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09  
**Framework:** React 18 + TypeScript + Vite  
**Theme:** Light | Primary Color: `#042E6F`

---

## 1. Design System

### 1.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#042E6F` | Buttons, headers, active nav, links |
| `primary-light` | `#1A4B9C` | Hover states, secondary buttons |
| `primary-xlight` | `#E8EEF8` | Background highlights, selected states |
| `white` | `#FFFFFF` | Page backgrounds, card backgrounds |
| `gray-50` | `#F9FAFB` | Page canvas background |
| `gray-100` | `#F3F4F6` | Kanban column backgrounds |
| `gray-200` | `#E5E7EB` | Borders, dividers |
| `gray-600` | `#4B5563` | Secondary text |
| `gray-900` | `#111827` | Primary text |
| `success` | `#16A34A` | Completed tasks, success toasts |
| `warning` | `#D97706` | Deadline reminders, medium priority |
| `danger` | `#DC2626` | Overdue tasks, critical priority |
| `info` | `#2563EB` | Informational badges |

### 1.2 Typography

```css
/* Font: Inter (Google Fonts) */
--font-family: 'Inter', sans-serif;

--text-xs:   0.75rem  / 1rem    /* Badges, timestamps */
--text-sm:   0.875rem / 1.25rem /* Secondary labels, table data */
--text-base: 1rem     / 1.5rem  /* Body text */
--text-lg:   1.125rem / 1.75rem /* Card titles */
--text-xl:   1.25rem  / 1.75rem /* Section headers */
--text-2xl:  1.5rem   / 2rem    /* Page titles */
--text-3xl:  1.875rem / 2.25rem /* Dashboard summary numbers */
```

### 1.3 Spacing & Layout

- Base unit: `4px` (Tailwind's default)
- Container max-width: `1280px`
- Sidebar width: `240px` (collapsed: `64px`)
- Kanban card width: `280px`
- Card border-radius: `8px`
- Modal border-radius: `12px`

### 1.4 Priority Badge Colors

| Priority | Background | Text | Border |
|----------|------------|------|--------|
| Low | `#F0FDF4` | `#16A34A` | `#BBF7D0` |
| Medium | `#FFFBEB` | `#D97706` | `#FDE68A` |
| High | `#FFF7ED` | `#EA580C` | `#FED7AA` |
| Critical | `#FEF2F2` | `#DC2626` | `#FECACA` |

### 1.5 Task Status Colors

| Status | Color | Badge Style |
|--------|-------|-------------|
| New | `#2563EB` | Blue outline |
| In Progress | `#D97706` | Amber filled |
| Completed (Early) | `#16A34A` | Green filled |
| Completed | `#4B5563` | Gray filled |
| Overdue | `#DC2626` | Red filled + pulse animation |

---

## 2. Project Structure

```
apps/web/
├── src/
│   ├── assets/                  # Static assets (logo, images)
│   ├── components/
│   │   ├── ui/                  # Base UI components (Button, Input, Badge, Modal...)
│   │   ├── layout/              # AppShell, Sidebar, TopNav, PageHeader
│   │   └── shared/              # Shared composable components
│   │       ├── KanbanBoard/
│   │       ├── TaskCard/
│   │       ├── NotificationPanel/
│   │       ├── UserAvatar/
│   │       └── PriorityBadge/
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── pages/LoginPage.tsx
│   │   │   ├── hooks/useAuth.ts
│   │   │   └── components/LoginForm.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── pages/
│   │   │   │   ├── AuditorDashboard.tsx
│   │   │   │   └── ManagerDashboard.tsx
│   │   │   └── components/
│   │   │       ├── SummaryCards.tsx
│   │   │       ├── TeamOverview.tsx
│   │   │       └── AuditorActivityPanel.tsx
│   │   │
│   │   ├── tasks/
│   │   │   ├── pages/
│   │   │   │   ├── TaskDetailPage.tsx
│   │   │   │   └── CreateTaskPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── TaskForm.tsx
│   │   │   │   ├── AssigneeSelector.tsx
│   │   │   │   ├── TaskStatusActions.tsx
│   │   │   │   └── SubTaskPanel.tsx
│   │   │   └── hooks/
│   │   │       ├── useTasks.ts
│   │   │       └── useTaskMutation.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── components/NotificationDropdown.tsx
│   │   │   └── hooks/useNotifications.ts
│   │   │
│   │   └── admin/
│   │       ├── pages/
│   │       │   ├── AdminDashboard.tsx
│   │       │   ├── UserManagementPage.tsx
│   │       │   └── ActivityLogsPage.tsx
│   │       └── components/
│   │           ├── UserForm.tsx
│   │           └── UserTable.tsx
│   │
│   ├── hooks/
│   │   ├── useSocket.ts         # Socket.io connection + events
│   │   ├── useCurrentUser.ts    # Auth state
│   │   └── useDebounce.ts
│   │
│   ├── lib/
│   │   ├── api.ts               # Axios instance + interceptors
│   │   ├── queryClient.ts       # TanStack Query client config
│   │   └── socket.ts            # Socket.io client singleton
│   │
│   ├── store/
│   │   ├── authStore.ts         # Zustand: user, token, role
│   │   └── uiStore.ts           # Zustand: sidebar open, theme
│   │
│   ├── router/
│   │   ├── index.tsx            # React Router setup
│   │   ├── ProtectedRoute.tsx   # Role-based route guard
│   │   └── routes.ts            # Route path constants
│   │
│   ├── types/
│   │   └── index.ts             # Shared TypeScript interfaces
│   │
│   ├── utils/
│   │   ├── dateFormat.ts
│   │   └── classNames.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── index.html
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## 3. Page Layouts

### 3.1 App Shell (Authenticated)

```
┌──────────────────────────────────────────────────────┐
│  TopNav: [Logo] [Page Title]       [🔔 Bell] [Avatar]│
├─────────────┬────────────────────────────────────────┤
│             │                                        │
│  Sidebar    │           Main Content Area            │
│  (240px)    │                                        │
│             │                                        │
│  Nav Items  │                                        │
│  ─────────  │                                        │
│  Dashboard  │                                        │
│  My Tasks   │                                        │
│  Team View  │                                        │
│  (manager)  │                                        │
│  Admin      │                                        │
│  (admin)    │                                        │
│  ─────────  │                                        │
│  Profile    │                                        │
│  Logout     │                                        │
└─────────────┴────────────────────────────────────────┘
```

### 3.2 Auditor Kanban Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  My Dashboard              [+ Assign Task]  [Filter ▼]  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌──── New Tasks ────┐ ┌─ In Progress ─┐ ┌─Completed─┐ │
│  │  (count badge: 3) │ │ (count: 2)    │ │ (count: 8)│ │
│  │                   │ │               │ │           │ │
│  │ ┌───────────────┐ │ │ ┌───────────┐ │ │ ┌───────┐ │ │
│  │ │ Task Title    │ │ │ │ Task Title│ │ │ │ Task  │ │ │
│  │ │ 🔴 Critical   │ │ │ │ 🟡 Medium │ │ │ │ ✅    │ │ │
│  │ │ Due: Mar 15   │ │ │ │ Due Mar20 │ │ │ │ Early │ │ │
│  │ │ IT Audit      │ │ │ │ COE Team  │ │ │ │       │ │ │
│  │ │ [👤 👤 +1]    │ │ │ │ [👤]      │ │ │ │       │ │ │
│  │ └───────────────┘ │ │ └───────────┘ │ │ └───────┘ │ │
│  │ ┌───────────────┐ │ │               │ │           │ │
│  │ │ Task Title    │ │ │ ┌───────────┐ │ │           │ │
│  │ │ 🟢 Low        │ │ │ │ OVERDUE🔴 │ │ │           │ │
│  │ │ Due: Apr 1    │ │ │ │ Due Mar 5 │ │ │           │ │
│  │ └───────────────┘ │ │ └───────────┘ │ │           │ │
│  └───────────────────┘ └───────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Manager Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  Manager Overview                  [+ New Task]         │
│  ─────────────────────────────────────────────────────  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 24       │ │ 5        │ │ 3        │ │ 16       │   │
│  │ Active   │ │ Overdue  │ │ Due Soon │ │ Done     │   │
│  │ Tasks    │ │ 🔴       │ │ ⚠️       │ │ This Wk  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  Team Overview       [All Teams ▼]  [List | Kanban ▼]  │
│  ┌─── IT Audit ────────────────────────────────────┐   │
│  │  New: 4 | In Progress: 6 | Completed: 12        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Individual Auditor View   [Select Auditor ▼]           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Jane Doe | IT Audit Team                         │  │
│  │ Completion Rate: 87%  |  Overdue: 1  |  Active: 3│  │
│  │ ─────────────────────────────────────────────── │  │
│  │ [Recent Task History Timeline]                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Task Creation Form (Manager)

```
┌──────────────────────────────────────────────┐
│  Assign New Task                          ✕  │
│  ──────────────────────────────────────────  │
│  Project Title *                             │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Description *                               │
│  ┌────────────────────────────────────────┐  │
│  │ [Rich Text Editor]                     │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Start Date *          End Date *            │
│  ┌──────────────┐      ┌──────────────┐      │
│  │  Mar 15 2026 │      │  Mar 30 2026 │      │
│  └──────────────┘      └──────────────┘      │
│                                              │
│  Priority                                    │
│  [ Low ] [ Medium ] [●High] [ Critical ]     │
│                                              │
│  Assign Persons * (searchable multi-select)  │
│  ┌────────────────────────────────────────┐  │
│  │ 🔍 Search by name or team...           │  │
│  │ ──────────────────────────────────     │  │
│  │ ☑ John Doe         IT Audit            │  │
│  │ ☑ Jane Smith       COE Team            │  │
│  │ ☐ Mike Johnson     Project Audit       │  │
│  └────────────────────────────────────────┘  │
│  Selected: [John Doe ✕] [Jane Smith ✕]       │
│                                              │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │  Save Draft  │  │     Submit Task    │   │
│  └──────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────┘
```

---

## 4. Key Components

### 4.1 TaskCard Component
```typescript
interface TaskCardProps {
  task: Task;
  onDragStart?: () => void;
  onClick: () => void;
}
// Shows: title, priority badge, due date, team tag, assignee avatars
// Overdue: red border + "OVERDUE" pill
// Completed Early: green checkmark badge
```

### 4.2 AssigneeSelector Component
```typescript
interface AssigneeSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  filterByTeam?: TeamName;
}
// Searchable multi-select dropdown
// Groups auditors by team
// Shows avatar + name + team
// Max visible selected: 5 (then "+N more")
```

### 4.3 KanbanBoard Component
```typescript
interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  readonly?: boolean; // For manager view
}
// Three columns: NEW | IN_PROGRESS | COMPLETED
// Drag-and-drop via @dnd-kit
// Column headers show count badge
// Scroll within columns when overflow
```

### 4.4 NotificationDropdown Component
- Bell icon in TopNav with unread count badge
- Dropdown list of recent notifications
- Click notification → navigate to related task
- "Mark all as read" button
- Real-time updates via Socket.io

---

## 5. Routing Structure

```typescript
// Public routes
/login

// Auditor routes (role: AUDITOR)
/auditor/dashboard
/auditor/tasks/:id
/profile

// Manager routes (role: MANAGER)
/manager/dashboard
/manager/tasks/new
/manager/tasks/:id
/manager/team-view
/manager/auditor/:id

// Admin routes (role: ADMIN)
/admin/dashboard
/admin/users
/admin/users/new
/admin/users/:id/edit
/admin/logs
/admin/settings

// Shared
/notifications
/profile
```

---

## 6. State Management

### Zustand Stores

**authStore.ts**
```typescript
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}
```

**uiStore.ts**
```typescript
interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  notificationCount: number;
  setNotificationCount: (n: number) => void;
}
```

### TanStack Query Keys

```typescript
export const queryKeys = {
  tasks: {
    all: ['tasks'],
    byId: (id: string) => ['tasks', id],
    myTasks: () => ['tasks', 'mine'],
    byTeam: (teamId: string) => ['tasks', 'team', teamId],
  },
  users: {
    all: ['users'],
    byId: (id: string) => ['users', id],
  },
  notifications: {
    all: ['notifications'],
  },
};
```

---

## 7. API Service Layer

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // for refresh token cookie
});

// Auto-attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401) {
    const newToken = await refreshToken();
    if (newToken) return api.request(error.config);
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
  }
  return Promise.reject(error);
});
```

---

## 8. Real-Time Socket Integration

```typescript
// hooks/useSocket.ts
export const useSocket = () => {
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const socket = getSocket(); // singleton
    socket.auth = { token: accessToken };
    socket.connect();

    socket.on('notification:new', (notification) => {
      queryClient.invalidateQueries(queryKeys.notifications.all);
      uiStore.setNotificationCount((prev) => prev + 1);
      toast.info(notification.message);
    });

    socket.on('task:status_changed', ({ taskId }) => {
      queryClient.invalidateQueries(queryKeys.tasks.byId(taskId));
    });

    return () => { socket.disconnect(); };
  }, [accessToken]);
};
```

---

## 9. Environment Variables (Frontend)

```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_SOCKET_URL=http://localhost:4000
VITE_APP_NAME=APMS
```

---

## 10. Tailwind Configuration

```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#042E6F',
          light:   '#1A4B9C',
          xlight:  '#E8EEF8',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger:  '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
};
```
