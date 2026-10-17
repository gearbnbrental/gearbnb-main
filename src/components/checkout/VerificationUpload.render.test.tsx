import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { CatalogProvider } from '../../context/CatalogContext';
import { RentalProvider } from '../../context/RentalContext';
import VerificationUpload, { SavedDocumentCard } from './VerificationUpload';

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// Rendering must never throw: a crash here would blank the whole checkout step. (Effects do not run in a static
// render, so this guards the render-time code only; the helpers behind the behaviour have their own tests.)
describe('SavedDocumentCard', () => {
  it('says the saved document is in use, shows when it was verified and kept until, and offers a replacement', () => {
    const out = text(
      renderToStaticMarkup(
        <SavedDocumentCard title="Government ID #1" details="Verified Oct 2, 2026 · kept until Dec 30, 2026" onReplace={() => {}} />,
      ),
    );
    expect(out).toContain('Government ID #1');
    expect(out).toContain('Using your saved document');
    expect(out).toContain('Verified Oct 2, 2026 · kept until Dec 30, 2026');
    expect(out).toContain('Replace with a new file');
  });
});

describe('VerificationUpload', () => {
  it('still renders all four upload slots for a customer with nothing saved, as before', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <CatalogProvider>
            <RentalProvider>
              <VerificationUpload />
            </RentalProvider>
          </CatalogProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    const out = text(html);
    for (const title of ['Government ID #1', 'Government ID #2', 'Video Verification', 'Proof of Billing']) {
      expect(out).toContain(title);
    }
    expect(out).not.toContain('Welcome back');
    expect(out).not.toContain('Using your saved document');
  });
});
