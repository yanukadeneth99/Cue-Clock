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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the main heading', () => {
    render(<Home />);
    expect(screen.getByText(/Simple Timer/i)).toBeInTheDocument();
  });

  describe('Mobile Menu Toggle and Links', () => {
    it('has a functional mobile menu toggle', () => {
      render(<Home />);

      // Find the toggle button
      const menuButtons = screen.getAllByRole('button');
      const menuToggle = menuButtons.find(btn => btn.textContent?.includes('menu') || btn.textContent?.includes('close'));

      if (menuToggle) {
        expect(menuToggle).toBeInTheDocument();
        // Test toggle open
        fireEvent.click(menuToggle);
        expect(menuToggle.textContent?.includes('close')).toBeTruthy();

        // The overlay should have opacity-100 class
        const overlay = document.querySelector('.fixed.inset-0.z-\\[10000\\]');
        expect(overlay?.className).toContain('opacity-100');

        // Test toggle close
        fireEvent.click(menuToggle);
        expect(overlay?.className).toContain('opacity-0');
      }
    });

    it('closes mobile menu when a link is clicked', () => {
      render(<Home />);

      const menuButtons = screen.getAllByRole('button');
      const menuToggle = menuButtons.find(btn => btn.textContent?.includes('menu') || btn.textContent?.includes('close'));

      if (menuToggle) {
        // Open menu
        fireEvent.click(menuToggle);

        const overlay = document.querySelector('.fixed.inset-0.z-\\[10000\\]');
        expect(overlay?.className).toContain('opacity-100');

        // Click a link inside the menu
        // We have two 'Features' links, one in desktop nav and one in mobile
        // The mobile ones have specific text styling classes
        const links = screen.getAllByText('Features');
        const mobileLink = links.find(el => el.className.includes('text-2xl'));

        if (mobileLink) {
          fireEvent.click(mobileLink);
          // Menu should close
          expect(overlay?.className).toContain('opacity-0');
        }
      }
    });
  });

  describe('Platform Button Interactions', () => {
    it('renders platform buttons correctly and handles clicks', () => {
      render(<Home />);

      // Search for iOS text which is the default active tab
      expect(screen.getByText('iOS')).toBeInTheDocument();

      // Ensure iOS specific text is there by default
      const comingSoonButtons = screen.getAllByText(/Coming Soon/i);
      expect(comingSoonButtons.length).toBeGreaterThan(0);

      // Click Web platform
      const webButton = screen.getByText('Web');
      fireEvent.click(webButton);

      // And see the "Start Now" text on the main download button
      const startNowButtons = screen.getAllByText(/Start Now/i);
      expect(startNowButtons.length).toBeGreaterThan(0);

      // Click Android platform
      const androidButton = screen.getByText('Android');
      fireEvent.click(androidButton);

      // And see the "Coming Soon" text again
      const comingSoonButtonsAfterAndroid = screen.getAllByText(/Coming Soon/i);
      expect(comingSoonButtonsAfterAndroid.length).toBeGreaterThan(0);
    });
  });

  describe('Window Open Actions', () => {
    let originalOpen: typeof window.open;

    beforeEach(() => {
      originalOpen = window.open;
      window.open = jest.fn();
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('opens web app when "Start Now" button is clicked', () => {
      render(<Home />);

      const startNowButtons = screen.getAllByText('Start Now');
      expect(startNowButtons.length).toBeGreaterThan(0);

      // Click the first one (usually the one in the hero section)
      fireEvent.click(startNowButtons[0]);

      expect(window.open).toHaveBeenCalledWith('https://live.cueclock.app', '_blank');
    });

    it('scrolls to download section when "Download Free Now" button is clicked', () => {
      render(<Home />);

      // Mock scrollIntoView
      const mockScrollIntoView = jest.fn();
      const mockElement = { scrollIntoView: mockScrollIntoView };

      // Mock document.getElementById to return our fake element
      const originalGetElementById = document.getElementById;
      document.getElementById = jest.fn().mockImplementation((id) => {
        if (id === 'download') return mockElement;
        return null;
      });

      const downloadButtons = screen.getAllByText(/Download Free Now/i);
      expect(downloadButtons.length).toBeGreaterThan(0);

      fireEvent.click(downloadButtons[0]);

      expect(document.getElementById).toHaveBeenCalledWith('download');
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });

      // Restore document.getElementById
      document.getElementById = originalGetElementById;
    });

    it('opens web app from mobile menu "Start Now"', () => {
      render(<Home />);

      const menuButtons = screen.getAllByRole('button');
      const menuToggle = menuButtons.find(btn => btn.textContent?.includes('menu') || btn.textContent?.includes('close'));

      if (menuToggle) {
        // Open menu
        fireEvent.click(menuToggle);

        // Find the "Start Now" button in the mobile menu
        // It has specific styling classes
        const startNowButtons = screen.getAllByText('Start Now');
        const mobileStartBtn = startNowButtons.find(btn => btn.className.includes('mt-8 bg-primary text-on-primary'));

        if (mobileStartBtn) {
          fireEvent.click(mobileStartBtn);

          expect(window.open).toHaveBeenCalledWith('https://live.cueclock.app', '_blank');

          // Menu should close
          const overlay = document.querySelector('.fixed.inset-0.z-\\[10000\\]');
          expect(overlay?.className).toContain('opacity-0');
        }
      }
    });
  });

  describe('Contributor Fetching', () => {
    it('fetches and displays contributors on mount', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { id: 1, login: 'testuser', avatar_url: 'http://test.com/avatar.png', html_url: 'http://github.com/testuser' }
        ])
      });

      render(<Home />);

      // Wait for fetch to be called
      expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/repos/yanukadeneth99/Cue-Clock/contributors');

      // The image should render eventually
      const avatar = await screen.findByAltText('testuser');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('http://test.com/avatar.png')));
    });

    it('gracefully handles fetch errors', async () => {
      // Suppress console.error for this test if needed, though the component swallows it
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      render(<Home />);

      expect(global.fetch).toHaveBeenCalled();

      // Ensure that instead of crashing, we still have the pulsing placeholders
      // We look for elements with the animate-pulse class by default if contributors are empty
      // wait a bit for effect to settle
      await new Promise((r) => setTimeout(r, 0));

      const placeholders = document.querySelectorAll('.animate-pulse');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('gracefully handles non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      });

      render(<Home />);

      expect(global.fetch).toHaveBeenCalled();

      await new Promise((r) => setTimeout(r, 0));

      const placeholders = document.querySelectorAll('.animate-pulse');
      expect(placeholders.length).toBeGreaterThan(0);
    });
  });
});
