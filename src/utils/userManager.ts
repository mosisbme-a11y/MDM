// User account management. Accounts live in Supabase Auth (email + password) with a
// profile row in public.users. All changes go through the admin-only /api/admin/users
// endpoints on the server; this file never sees or stores a password after it is sent.

export interface AuthorizedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  hub: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface NewUserInput {
  email: string;
  password: string;
  name: string;
  role: string;
  hub: string;
  isAdmin: boolean;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body as T;
}

export const fetchAuthorizedUsers = async (): Promise<AuthorizedUser[]> => {
  const data = await call<{ users: AuthorizedUser[] }>('/api/admin/users');
  return data.users;
};

export const addAuthorizedUser = async (input: NewUserInput): Promise<AuthorizedUser> => {
  const data = await call<{ user: AuthorizedUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return data.user;
};

export const deleteAuthorizedUser = async (id: string): Promise<void> => {
  await call(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

export const resetUserPassword = async (id: string, newPassword: string): Promise<void> => {
  await call(`/api/admin/users/${encodeURIComponent(id)}/password`, {
    method: 'POST',
    body: JSON.stringify({ password: newPassword })
  });
};

export const updateAuthorizedUser = async (
  id: string,
  changes: Partial<Pick<AuthorizedUser, 'name' | 'role' | 'hub' | 'isAdmin' | 'isActive'>>
): Promise<AuthorizedUser> => {
  const data = await call<{ user: AuthorizedUser }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
  return data.user;
};
