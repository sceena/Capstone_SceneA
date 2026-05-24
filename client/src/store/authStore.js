import { useState, useEffect } from 'react';

const listeners = new Set();
let state = {
  user: JSON.parse(localStorage.getItem('scena_auth') || 'null'),
};

function setState(partial) {
  state = { ...state, ...partial };
  localStorage.setItem('scena_auth', JSON.stringify(state.user));
  listeners.forEach(fn => fn(state));
}

export function setAuthUser(user) {
  setState({ user });
}

export function clearAuthUser() {
  setState({ user: null });
}

export function getAuthUser() {
  return state.user;
}

export default function useAuthStore() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}
