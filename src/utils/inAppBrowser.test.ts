import { describe, expect, it } from 'vitest';
import { inAppBrowserName } from './inAppBrowser';

describe('inAppBrowserName', () => {
  it('spots the Facebook app browser on iPhone and Android', () => {
    expect(
      inAppBrowserName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0;FBBV/1]',
      ),
    ).toBe('Facebook');
    expect(
      inAppBrowserName(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
      ),
    ).toBe('Facebook');
  });

  it('tells Messenger apart from Facebook', () => {
    expect(
      inAppBrowserName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.0]',
      ),
    ).toBe('Messenger');
    expect(
      inAppBrowserName('Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0]'),
    ).toBe('Messenger');
  });

  it('spots Instagram and TikTok', () => {
    expect(inAppBrowserName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Instagram 350.0.0.0')).toBe('Instagram');
    expect(inAppBrowserName('Mozilla/5.0 (Linux; Android 14; wv) Chrome/130.0 Mobile Safari/537.36 musical_ly_2023')).toBe('TikTok');
  });

  it('leaves ordinary browsers alone', () => {
    expect(
      inAppBrowserName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'),
    ).toBeNull();
    expect(inAppBrowserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBeNull();
  });
});
