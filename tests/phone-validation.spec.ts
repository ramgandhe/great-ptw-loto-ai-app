import { splitPhone } from '../frontend/src/lib/validation';

describe('splitPhone', () => {
  it('reads an empty number after the country code as empty, not as the code digits', () => {
    // A new person form starts the phone as "+91 "; this used to come back as number "91",
    // which failed the 10-digit pattern and blocked saving the form without a phone.
    expect(splitPhone('+91 ')).toEqual({ code: '+91', number: '' });
    expect(splitPhone('+971')).toEqual({ code: '+971', number: '' });
  });

  it('keeps splitting stored numbers as before', () => {
    expect(splitPhone('+91 9876543210')).toEqual({ code: '+91', number: '9876543210' });
    expect(splitPhone('+971 501234567')).toEqual({ code: '+971', number: '501234567' });
    expect(splitPhone('98765 43210')).toEqual({ code: '+91', number: '9876543210' });
    expect(splitPhone(null)).toEqual({ code: '+91', number: '' });
  });
});
