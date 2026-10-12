// בדיקות לשמירה על מסכים.

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireRoleLevel } from './ProtectedRoute';
import { ROLE_LEVEL } from '../lib/permissions';
import { useAuth } from './AuthContext';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));

function renderGuardedRoute(activeRole) {
  vi.mocked(useAuth).mockReturnValue({ activeRole });

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
              <div>Secret content</div>
            </RequireRoleLevel>
          }
        />
        <Route path="/403" element={<div>Forbidden page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRoleLevel', () => {
  it('renders its children when the active role meets the minimum level', () => {
    renderGuardedRoute('PROJECT_MANAGER');

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('renders its children when the active role exceeds the minimum level', () => {
    renderGuardedRoute('SYSTEM_ADMIN');

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('redirects to /403 when the active role is below the minimum level', () => {
    renderGuardedRoute('EMPLOYEE');

    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });
});
