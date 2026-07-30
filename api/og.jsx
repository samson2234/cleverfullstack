import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const accent = '#4F46E5';
const bg = '#0E1330';
const bg2 = '#171D45';
const white = '#FFFFFF';
const muted = '#C7CBE8';

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const title = url.searchParams.get('title') || 'Full-Stack Development Studio';
    const type = url.searchParams.get('type') || 'website';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${bg} 0%, ${bg2} 50%, #232A5E 100%)`,
            padding: '80px 100px',
            fontFamily: 'system-ui',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: type === 'article' ? 32 : 48 }}>
            <div style={{ width: 56, height: 56, background: accent, borderRadius: 14 }} />
            <div style={{ fontSize: 44, fontWeight: 700, color: white, display: 'flex' }}>
              Clever
              <span style={{ color: accent }}>Stack</span>
            </div>
          </div>

          {type === 'article' && (
            <div style={{ fontSize: 16, color: accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
              Blog Post
            </div>
          )}

          <div
            style={{
              fontSize: type === 'article' ? 48 : 56,
              fontWeight: 800,
              color: white,
              textAlign: 'center',
              lineHeight: 1.2,
              maxWidth: 900,
            }}
          >
            {title}
          </div>

          <div style={{ width: 100, height: 4, background: accent, borderRadius: 2, marginTop: 36 }} />

          <div
            style={{
              fontSize: 18,
              color: muted,
              marginTop: 28,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Full-Stack Development Studio
          </div>

          {type === 'article' && (
            <div style={{ fontSize: 14, color: muted, marginTop: 16, opacity: 0.7 }}>
              cleverfullstack.vercel.app
            </div>
          )}
        </div>
      ),
      { width: 1200, height: 630 },
    );
  } catch (e) {
    return new Response('OG generation failed', { status: 500 });
  }
}
