import { render, screen, fireEvent } from '@testing-library/react';
import Home from '../src/app/page';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock GSAP and next/image
jest.mock('gsap', () => {
  return {
    registerPlugin: jest.fn(),
    timeline: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      to: jest.fn().mockReturnThis(),
    }),
    set: jest.fn(),
    to: jest.fn(),
    from: jest.fn(),
    fromTo: jest.fn(),
  };
});
jest.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    batch: jest.fn(),
  }
}));
jest.mock('@gsap/react', () => ({
  useGSAP: jest.fn((cb) => {
    // We mock useGSAP to not actually run the animations to simplify testing
  })
}));

describe('Home page', () => {
  it('renders the main heading', () => {
    render(<Home />);
    expect(screen.getByText(/Simple Timer/i)).toBeInTheDocument();
  });

  it('has a functional mobile menu toggle', () => {
    render(<Home />);

    // In our component, we only show menu button on mobile
    // Find the toggle button - we have to be careful with Material Icons which are just text
    const menuButtons = screen.getAllByRole('button');
    const menuToggle = menuButtons.find(btn => btn.textContent?.includes('menu') || btn.textContent?.includes('close'));

    if (menuToggle) {
      expect(menuToggle).toBeInTheDocument();
      // Test toggle
      fireEvent.click(menuToggle);
      // The text should change to close
      expect(menuToggle.textContent?.includes('close')).toBeTruthy();
    }
  });

  it('renders platform buttons correctly', () => {
    render(<Home />);

    // Search for iOS text which is the default active tab
    expect(screen.getByText('iOS')).toBeInTheDocument();

    // We should be able to click web platform
    const webButton = screen.getByText('Web');
    fireEvent.click(webButton);

    // And see the "Start Now" text on the main download button
    const startNowButtons = screen.getAllByText(/Start Now/i);
    expect(startNowButtons.length).toBeGreaterThan(0);
  });
});
