export interface AuthorizedUser {
  id: string;
  username: string;
  email: string;
  password: string;
  name: string;
  role: string;
  hub: string;
  isAdmin: boolean;
  createdAt: string;
}

const USERS_STORAGE_KEY = 'epss_authorized_users_v1';

export const DEFAULT_AUTHORIZED_USERS: AuthorizedUser[] = [
  {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@epss.gov.et',
    password: 'password123',
    name: 'EPSS System Admin',
    role: 'Inventory Administrator',
    hub: 'Head Office Addis Ababa',
    isAdmin: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-mosisa',
    username: 'mosisa',
    email: 'mosisbme@gmail.com',
    password: 'password123',
    name: 'Mosisa Berhanu',
    role: 'Biomedical Specialist',
    hub: 'Central Hub (HO01)',
    isAdmin: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-regional',
    username: 'regional',
    email: 'regional@epss.gov.et',
    password: 'password123',
    name: 'Regional Hub Lead',
    role: 'Regional Biomedical Officer',
    hub: 'Hawassa / Adama Hubs',
    isAdmin: false,
    createdAt: new Date().toISOString()
  }
];

export const getAuthorizedUsers = (): AuthorizedUser[] => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load authorized users from localStorage', err);
  }
  // Initialize with defaults if empty
  saveAuthorizedUsers(DEFAULT_AUTHORIZED_USERS);
  return DEFAULT_AUTHORIZED_USERS;
};

export const saveAuthorizedUsers = (users: AuthorizedUser[]): void => {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('epss_users_updated', { detail: users }));

    // Sync to backend server disk storage
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    }).catch(err => console.warn('Failed to sync users to server disk:', err));
  } catch (err) {
    console.error('Failed to save authorized users:', err);
  }
};

export const syncUsersFromServer = async (): Promise<AuthorizedUser[]> => {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.users) && data.users.length > 0) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data.users));
        return data.users;
      }
    }
  } catch (err) {
    console.warn('Could not fetch users from server', err);
  }
  return getAuthorizedUsers();
};

export const addAuthorizedUser = (user: Omit<AuthorizedUser, 'id' | 'createdAt'>): AuthorizedUser => {
  const users = getAuthorizedUsers();
  const newUser: AuthorizedUser = {
    ...user,
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveAuthorizedUsers(users);
  return newUser;
};

export const updateAuthorizedUser = (updatedUser: AuthorizedUser): void => {
  let users = getAuthorizedUsers();
  users = users.map(u => u.id === updatedUser.id ? updatedUser : u);
  saveAuthorizedUsers(users);
};

export const deleteAuthorizedUser = (id: string): void => {
  let users = getAuthorizedUsers();
  // Prevent deleting primary admin
  users = users.filter(u => u.id !== id && u.username !== 'admin');
  saveAuthorizedUsers(users);
};

export const resetUserPassword = (id: string, newPassword: string): boolean => {
  const users = getAuthorizedUsers();
  let found = false;
  const updated = users.map(u => {
    if (u.id === id) {
      found = true;
      return { ...u, password: newPassword };
    }
    return u;
  });
  if (found) {
    saveAuthorizedUsers(updated);
    return true;
  }
  return false;
};

export const authenticateUser = (usernameOrEmail: string, passwordInput: string): AuthorizedUser | null => {
  const users = getAuthorizedUsers();
  const query = usernameOrEmail.trim().toLowerCase();
  const pwd = passwordInput.trim();

  const found = users.find(
    u => (u.username.toLowerCase() === query || u.email.toLowerCase() === query) && u.password === pwd
  );

  return found || null;
};
