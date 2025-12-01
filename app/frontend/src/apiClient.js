// apiClient.js - API wrapper with JWT token management

// Backend API base URL (adjust if backend runs on different port)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';

let authToken = null;

/**
 * Set the authentication token (stored in memory + localStorage)
 */
export function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

/**
 * Get the current authentication token
 */
export function getToken() {
  return authToken;
}

/**
 * Initialize token from localStorage (call on app startup)
 */
export function initializeAuth() {
  const token = localStorage.getItem('auth_token');
  if (token) {
    authToken = token;
  }
  return {
    token: authToken,
    name: localStorage.getItem('auth_name'),
    isAdmin: localStorage.getItem('auth_isAdmin') === 'true'
  };
}
}

/**
 * Core fetch wrapper that automatically adds auth headers
 */
export async function apiFetch(path, options = {}) {
  const headers = { ...options.headers };

  // Add auth token if available
  if (authToken) {
    headers['X-Authorization'] = `bearer ${authToken}`;
  }

  // Auto-stringify JSON body
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  // Build full URL with base
  const url = `${API_BASE_URL}${path}`;
  
  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  if (body) {
    console.log('Request body:', body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body
  });
  
  console.log(`API Response: ${response.status} ${response.statusText}`);

  return response;
}

/**
 * Authenticate user and get JWT token
 */
export async function authenticate(name, password) {
  const response = await apiFetch('/authenticate', {
    method: 'PUT',
    body: { 
      user: { name, is_admin: true },
      secret: { password }
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Authentication failed' }));
    throw new Error(error.error || 'Authentication failed');
  }

  // Backend returns the token as a plain JSON string like "bearer <token>"
  const tokenString = await response.json();
  const token = tokenString.replace(/^bearer\s+/i, '');

  // Store token and user info
  setToken(token);
  localStorage.setItem('auth_name', name);
  localStorage.setItem('auth_isAdmin', 'true');

  return {
    token,
    name,
    is_admin: true
  };
}

/**
 * Get health status
 */
export async function getHealth() {
  const response = await apiFetch('/health');
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch health' }));
    throw new Error(error.error || 'Failed to fetch health');
  }

  return response.json();
}

/**
 * Get an artifact by type and id
 */
export async function getArtifact(type, id) {
  const response = await apiFetch(`/artifacts/${type}/${id}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch artifact' }));
    throw new Error(error.error || 'Failed to fetch artifact');
  }

  return response.json();
}

/**
 * Create a new artifact
 */
export async function createArtifact(type, url) {
  const response = await apiFetch(`/artifact/${type}`, {
    method: 'POST',
    body: { url }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create artifact' }));
    throw new Error(error.error || 'Failed to create artifact');
  }

  return response.json();
}

/**
 * List artifacts matching queries (POST /artifacts)
 * @param {Array} queries - [{ name: string, types?: string[] }]
 * @param {number} offset - optional pagination offset
 */
export async function listArtifacts(queries, offset = 0) {
  const queryString = offset ? `?offset=${offset}` : '';
  const response = await apiFetch(`/artifacts${queryString}`, {
    method: 'POST',
    body: queries
  });

  const nextOffset = response.headers.get('offset');

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to list artifacts' }));
    throw new Error(error.error || 'Failed to list artifacts');
  }

  const data = await response.json();
  return { data, nextOffset };
}

/**
 * Search artifacts by regex (POST /artifact/byRegEx)
 * @param {string} regex - regex string
 * @param {number} offset - optional pagination offset
 */
export async function searchArtifactsByRegex(regex, offset = 0) {
  const queryString = offset ? `?offset=${offset}` : '';
  const response = await apiFetch(`/artifact/byRegEx${queryString}`, {
    method: 'POST',
    body: { regex }
  });

  const nextOffset = response.headers.get('offset');

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to search artifacts' }));
    throw new Error(error.error || 'Failed to search artifacts');
  }

  const data = await response.json();
  return { data, nextOffset };
}

/**
 * Clear authentication (logout)
 */
export function clearAuth() {
  setToken(null);
  localStorage.removeItem('auth_name');
  localStorage.removeItem('auth_isAdmin');
}

/**
 * Create a new user (admin only)
 * @param {string} username - Username for new user
 * @param {string} password - Password for new user
 * @param {boolean} isAdmin - Whether the user should be an admin
 */
export async function createUser(username, password, isAdmin) {
  const response = await apiFetch('/users', {
    method: 'POST',
    body: { username, password, is_admin: isAdmin }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create user' }));
    throw new Error(error.error || 'Failed to create user');
  }

  return response.json();
}

/**
 * List all users (admin only)
 */
export async function listUsers() {
  const response = await apiFetch('/users');

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to list users' }));
    throw new Error(error.error || 'Failed to list users');
  }

  return response.json();
}

/**
 * Delete a user (admin only)
 * @param {string} username - Username to delete
 */
export async function deleteUser(username) {
  const response = await apiFetch(`/users/${username}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete user' }));
    throw new Error(error.error || 'Failed to delete user');
  }

  return response.json();
}
