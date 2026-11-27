import { Injectable } from '@nestjs/common';

export interface PostalLookupResult {
  pin: string;
  state: string;
  country: string;
  area?: string;
}

/**
 * Standard Indian postal code prefix-to-geography directory.
 * Maps exact PINs or 2-to-3 digit PIN prefix ranges to State and Country,
 * along with major hub/metro areas.
 */
const KNOWN_PINS: Record<string, { state: string; country: string; area: string }> = {
  // Karnataka (56-59)
  '560001': { state: 'Karnataka', country: 'India', area: 'Bengaluru G.P.O.' },
  '560002': { state: 'Karnataka', country: 'India', area: 'Bengaluru City' },
  '560100': { state: 'Karnataka', country: 'India', area: 'Electronics City' },
  '560066': { state: 'Karnataka', country: 'India', area: 'Whitefield' },
  '570001': { state: 'Karnataka', country: 'India', area: 'Mysuru' },
  '580001': { state: 'Karnataka', country: 'India', area: 'Hubballi' },

  // Maharashtra (40-44)
  '400001': { state: 'Maharashtra', country: 'India', area: 'Mumbai G.P.O.' },
  '400051': { state: 'Maharashtra', country: 'India', area: 'Bandra Kurla Complex' },
  '411001': { state: 'Maharashtra', country: 'India', area: 'Pune' },
  '440001': { state: 'Maharashtra', country: 'India', area: 'Nagpur' },

  // Delhi (11)
  '110001': { state: 'Delhi', country: 'India', area: 'New Delhi G.P.O.' },
  '110002': { state: 'Delhi', country: 'India', area: 'Darya Ganj' },
  '110020': { state: 'Delhi', country: 'India', area: 'Okhla' },

  // Tamil Nadu (60-64)
  '600001': { state: 'Tamil Nadu', country: 'India', area: 'Chennai G.P.O.' },
  '641001': { state: 'Tamil Nadu', country: 'India', area: 'Coimbatore' },

  // Telangana (50) & Andhra Pradesh (51-53)
  '500001': { state: 'Telangana', country: 'India', area: 'Hyderabad G.P.O.' },
  '500081': { state: 'Telangana', country: 'India', area: 'HITEC City' },
  '530001': { state: 'Andhra Pradesh', country: 'India', area: 'Visakhapatnam' },

  // West Bengal (70-74)
  '700001': { state: 'West Bengal', country: 'India', area: 'Kolkata G.P.O.' },

  // Gujarat (38-39)
  '380001': { state: 'Gujarat', country: 'India', area: 'Ahmedabad' },
  '395001': { state: 'Gujarat', country: 'India', area: 'Surat' },
  '390001': { state: 'Gujarat', country: 'India', area: 'Vadodara' },

  // Haryana (12-13)
  '122001': { state: 'Haryana', country: 'India', area: 'Gurugram' },

  // Uttar Pradesh (20-28)
  '201301': { state: 'Uttar Pradesh', country: 'India', area: 'Noida' },
  '226001': { state: 'Uttar Pradesh', country: 'India', area: 'Lucknow' },

  // Rajasthan (30-34)
  '302001': { state: 'Rajasthan', country: 'India', area: 'Jaipur G.P.O.' },

  // Kerala (67-69)
  '682001': { state: 'Kerala', country: 'India', area: 'Kochi' },
  '695001': { state: 'Kerala', country: 'India', area: 'Thiruvananthapuram' },
};

/**
 * 2-digit PIN prefix mapping for Indian postal circles.
 */
const PIN_PREFIX_STATE_MAP: Record<string, string> = {
  '11': 'Delhi',
  '12': 'Haryana',
  '13': 'Haryana',
  '14': 'Punjab',
  '15': 'Punjab',
  '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu & Kashmir',
  '19': 'Jammu & Kashmir',
  '20': 'Uttar Pradesh',
  '21': 'Uttar Pradesh',
  '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh',
  '24': 'Uttarakhand',
  '25': 'Uttar Pradesh',
  '26': 'Uttarakhand',
  '27': 'Uttar Pradesh',
  '28': 'Uttar Pradesh',
  '30': 'Rajasthan',
  '31': 'Rajasthan',
  '32': 'Rajasthan',
  '33': 'Rajasthan',
  '34': 'Rajasthan',
  '36': 'Gujarat',
  '37': 'Gujarat',
  '38': 'Gujarat',
  '39': 'Gujarat',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '43': 'Maharashtra',
  '44': 'Maharashtra',
  '45': 'Madhya Pradesh',
  '46': 'Madhya Pradesh',
  '47': 'Madhya Pradesh',
  '48': 'Madhya Pradesh',
  '49': 'Chhattisgarh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh',
  '52': 'Andhra Pradesh',
  '53': 'Andhra Pradesh',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '58': 'Karnataka',
  '59': 'Karnataka',
  '60': 'Tamil Nadu',
  '61': 'Tamil Nadu',
  '62': 'Tamil Nadu',
  '63': 'Tamil Nadu',
  '64': 'Tamil Nadu',
  '67': 'Kerala',
  '68': 'Kerala',
  '69': 'Kerala',
  '70': 'West Bengal',
  '71': 'West Bengal',
  '72': 'West Bengal',
  '73': 'West Bengal',
  '74': 'West Bengal',
  '75': 'Odisha',
  '76': 'Odisha',
  '77': 'Odisha',
  '78': 'Assam',
  '79': 'North Eastern',
  '80': 'Bihar',
  '81': 'Bihar',
  '82': 'Jharkhand',
  '83': 'Jharkhand',
  '84': 'Bihar',
  '85': 'Bihar',
};

@Injectable()
export class PostalLookupService {
  /**
   * Look up geography details by postal / PIN code.
   * Strips spaces and hyphens before lookup.
   */
  async lookup(rawPin: string): Promise<PostalLookupResult | null> {
    if (!rawPin || typeof rawPin !== 'string') return null;

    const normalized = rawPin.replace(/[\s-]/g, '').trim();

    // Indian PIN codes are 6 digits
    if (!/^\d{6}$/.test(normalized)) {
      return null;
    }

    if (KNOWN_PINS[normalized]) {
      return {
        pin: normalized,
        state: KNOWN_PINS[normalized].state,
        country: KNOWN_PINS[normalized].country,
        area: KNOWN_PINS[normalized].area,
      };
    }

    // Attempt live lookup with timeout to fetch area details
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://api.postalpincode.in/pincode/${normalized}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as Array<{
          Status?: string;
          PostOffice?: Array<{ Name?: string; State?: string; Country?: string; District?: string }>;
        }>;
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          const area = po.Name ?? po.District;
          const state = po.State;
          const country = po.Country ?? 'India';
          if (state) {
            return {
              pin: normalized,
              state,
              country,
              area: area || undefined,
            };
          }
        }
      }
    } catch {
      // Ignore network timeout, non-JSON response, or fetch errors and fall back to local prefix map
    }

    const prefix = normalized.substring(0, 2);
    const state = PIN_PREFIX_STATE_MAP[prefix];
    if (state) {
      return {
        pin: normalized,
        state,
        country: 'India',
      };
    }

    return null;
  }
}
