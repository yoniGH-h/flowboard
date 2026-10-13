// בדיקות למסך ההתחברות.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from './SignInPage';
import DemoAccounts from '../DemoAccounts';
import { useAuth } from '../AuthContext';
import { signIn } from '../../api/authApi';

vi.mock('../AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/authApi', async () => {
  const actual = await vi.importActual('../../api/authApi');
  return { ...actual, signIn: vi.fn() };
});

const signInWithResult = vi.fn();

const authResult = {
  user: {
    id: 'user-1',
    organizationId: 'org-1',
    firstName: 'Ava',
    lastName: 'Reynolds',
    email: 'ava.reynolds@nimbusdigital.io',
    avatarColor: '#2A6FB0',
    title: 'Product Manager',
    roles: ['PROJECT_MANAGER'],
    status: 'ACTIVE',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  organization: {
    id: 'org-1',
    name: 'Nimbus Digital',
    slug: 'nimbus-digital',
    status: 'ACTIVE',
    plan: 'TEAM',
    createdAt: '2026-01-01T00:00:00.000Z',
    memberCount: 10,
    projectCount: 3,
  },
};

// מצייר את מסך ההתחברות, לבדיקה.
function renderPage() {
  return render(
    <MemoryRouter>
      <SignInPage />
    </MemoryRouter>,
  );
}

describe('SignInPage validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ signInWithResult });
  });

  it('shows required-field errors and does not call signIn when both fields are empty', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows an email-format error and does not call signIn for a malformed email', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('calls signIn with the entered credentials and hydrates the session on success', async () => {
    vi.mocked(signIn).mockResolvedValueOnce(authResult);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email address/i), 'ava.reynolds@nimbusdigital.io');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('ava.reynolds@nimbusdigital.io', 'password123');
    });
    expect(signInWithResult).toHaveBeenCalledWith(authResult);
  });
});

describe('Demo accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ signInWithResult });
  });

  it('are not shown on the sign-in page unless demo mode is on', () => {
    renderPage();
    expect(screen.queryByText('DEMO ACCOUNTS')).not.toBeInTheDocument();
    expect(screen.queryByText('password123')).not.toBeInTheDocument();
  });

  it('sign in with the chosen account in one click', async () => {
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    render(<DemoAccounts onSignIn={onSignIn} disabled={false} />);

    await user.click(screen.getByRole('button', { name: /Priya Sharma/ }));

    expect(onSignIn).toHaveBeenCalledWith('priya.sharma@nimbusdigital.io', 'password123');
  });
});
