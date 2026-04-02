import { render, screen } from '@testing-library/react';
import PrivacyPolicy from '../src/app/privacy/page';

describe('Privacy Policy page', () => {
  it('renders the main heading', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('renders the back link', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByText(/Back to Cue Clock/i)).toBeInTheDocument();
  });

  it('contains email contact info', () => {
    render(<PrivacyPolicy />);
    const links = screen.getAllByRole('link', { name: 'hello@yashura.io' });
    expect(links.length).toBeGreaterThan(0);
  });
});
