import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthView } from './AuthView';

const renderAuthView = () =>
  render(
    <AuthView
      authFormMode="login"
      onToggleMode={vi.fn()}
      onSetMode={vi.fn()}
      authEmail=""
      onEmailChange={vi.fn()}
      authPassword=""
      onPasswordChange={vi.fn()}
      authFullName=""
      onFullNameChange={vi.fn()}
      authCompanyName=""
      onCompanyNameChange={vi.fn()}
      authSubmitting={false}
      guestSubmitting={false}
      onSubmit={vi.fn()}
      onStartGuest={vi.fn()}
      onViewPlans={vi.fn()}
      appError={null}
      useDemoCredentials={vi.fn()}
      onSubmitComplaint={vi.fn(async () => undefined)}
    />,
  );

describe('AuthView landing navigation', () => {
  it('links each navigation item to its corresponding landing section', () => {
    renderAuthView();

    expect(screen.getByRole('link', { name: /cómo funciona/i })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(screen.getByRole('link', { name: /cobertura normativa/i })).toHaveAttribute(
      'href',
      '#normative-coverage',
    );
    expect(document.querySelector('#how-it-works')).toHaveTextContent('Cómo funciona');
    expect(document.querySelector('#normative-coverage')).toHaveTextContent('Cobertura normativa');
  });
});
