import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button Component', () => {
  it('should render a button with the correct text', () => {
    render(<Button>Click Me</Button>);

    const buttonElement = screen.getByText(/Click Me/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('should apply the primary variant styles by default', () => {
    render(<Button>Click Me</Button>);

    const buttonElement = screen.getByRole('button');
    // We can't easily test the exact gradient, but we can check for a class
    // that is part of the primary variant.
    expect(buttonElement.className).toContain('from-pink-500');
  });
});
