// Ad set — production-correct sizes for paid media + organic social.
// LinkedIn single image 1200x627, Instagram square 1080x1080,
// IG/TikTok story 1080x1920, Display medium rectangle 300x250, Display leaderboard 728x90.
// Each ad uses ONE holo accent. Lime used sparingly. Editorial copy.

function AdLinkedIn1() {
  return (
    <DCArtboard id="ad-li-1" label="LinkedIn · 1200×627 · Burnout" width={1200} height={627}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '64px 72px',
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: 48,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Logo size={28} />
          <div>
            <div className="kicker" style={{ marginBottom: 16 }}>For senior people</div>
            <h2 className="display-xl" style={{ fontSize: 76, color: 'var(--marker-black)', marginBottom: 20, textWrap: 'balance' }}>
              You've done the<br/>hustle. You're<br/>allowed to stop.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--marker-text-soft)', maxWidth: 460, lineHeight: 1.5 }}>
              Marker finds you roles that pay well, sit nicely with your life, and won't burn you out a second time.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 20px' }}>Mark your moves →</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>marker.work · free for 7 days</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginTop: 4 }}>
            Illustrative score, based on public review data and policy pages.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            background: 'var(--marker-black)', color: 'var(--marker-cream)',
            borderRadius: 12, padding: 24, width: '100%', maxWidth: 340,
            transform: 'rotate(-2deg)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#A8A8A8', marginBottom: 8 }}>NATIONWIDE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginBottom: 18 }}>Head of Product, Lending</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#A8A8A8' }}>OFFICE · 1 day / wk</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#A8A8A8' }}>WLB · 4.4</span>
            </div>
            <div style={{
              background: 'var(--marker-lime)', color: 'var(--marker-black)',
              fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 500,
              padding: '10px 16px', borderRadius: 8, display: 'inline-block',
            }}>9.1</div>
          </div>
          {/* Holo accent — the foil chip */}
          <div className="holo-foil" style={{
            position: 'absolute', top: 30, right: 0,
            width: 60, height: 60, borderRadius: '50%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          }} />
        </div>

      </div>
    </DCArtboard>
  );
}

function AdLinkedIn2() {
  return (
    <DCArtboard id="ad-li-2" label="LinkedIn · 1200×627 · Editorial" width={1200} height={627}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-black)', color: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '64px 72px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={28} color="var(--marker-cream)" />
          <div className="kicker" style={{ color: 'var(--marker-mid)' }}>NO. 01 · BALANCED ROLES</div>
        </div>

        <h1 className="display-xl" style={{ fontSize: 110, color: 'var(--marker-cream)', textWrap: 'balance', maxWidth: 1000 }}>
          The job hunt,<br/>
          <span style={{ color: 'var(--marker-mid)' }}>marked.</span>
        </h1>

        <div className="holo-hairline" style={{ width: '100%' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 16, maxWidth: 540, color: 'var(--marker-cream)', opacity: 0.7, lineHeight: 1.5 }}>
            Every role scored against what you actually want. Sane hours. Fair pay. Companies that mean it.
          </div>
          <button style={{
            background: 'var(--marker-lime)', color: 'var(--marker-black)',
            border: 'none', padding: '14px 22px', borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
          }}>Start free →</button>
        </div>
      </div>
    </DCArtboard>
  );
}

function AdInstagramSquare() {
  return (
    <DCArtboard id="ad-ig-sq" label="Instagram · 1080×1080" width={1080} height={1080}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '80px 72px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={36} />
          <div className="kicker">A NEW JOB HUNT</div>
        </div>

        <div>
          <h2 className="display-xl" style={{ fontSize: 140, color: 'var(--marker-black)', textWrap: 'balance', lineHeight: 0.95 }}>
            Mark<br/>your<br/>moves.
          </h2>
        </div>

        <div>
          <div className="holo-hairline" style={{ marginBottom: 32 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 18, color: 'var(--marker-text-soft)', maxWidth: 600, lineHeight: 1.5 }}>
              For senior people who've done the hustle and would prefer not to do it again.
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--marker-black)' }}>marker.work →</div>
          </div>
        </div>

        {/* Single floating holo dot, top-right */}
        <div className="holo-dot" style={{
          position: 'absolute', top: 120, right: 90,
          width: 28, height: 28, borderRadius: '50%',
        }} />
      </div>
    </DCArtboard>
  );
}

function AdInstagramStory() {
  return (
    <DCArtboard id="ad-ig-story" label="Story · 1080×1920" width={1080} height={1920}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-black)', color: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '120px 64px 100px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={36} color="var(--marker-cream)" />
          <div className="chip chip-lime" style={{ fontSize: 11 }}>FREE · 7 DAYS</div>
        </div>

        <div>
          <div className="kicker" style={{ color: '#C6F432', marginBottom: 24 }}>For burned-out seniors</div>
          <h2 className="display-xl" style={{ fontSize: 160, color: 'var(--marker-cream)', lineHeight: 0.92, textWrap: 'balance' }}>
            You've done<br/>
            the hustle.<br/>
            <span style={{ color: 'var(--marker-mid)' }}>You're allowed<br/>to stop.</span>
          </h2>
        </div>

        {/* Floating score card */}
        <div style={{
          background: 'var(--marker-cream)', color: 'var(--marker-text)',
          borderRadius: 16, padding: 32, alignSelf: 'flex-end',
          width: 480, transform: 'rotate(-3deg)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--marker-mid)', marginBottom: 6 }}>WELLCOME TRUST</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, marginBottom: 18, color: 'var(--marker-black)' }}>Director of Product</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--marker-mid)' }}>1d office · 6mo leave</div>
            <div style={{ background: 'var(--marker-lime)', fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 500, padding: '6px 18px', borderRadius: 10, color: 'var(--marker-black)' }}>9.4</div>
          </div>
        </div>

        <div className="holo-hairline" style={{ width: '100%' }} />

        <div style={{ textAlign: 'center' }}>
          <button style={{
            background: 'var(--marker-lime)', color: 'var(--marker-black)',
            border: 'none', padding: '24px 48px', borderRadius: 100,
            fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 500, cursor: 'pointer',
            width: '100%',
          }}>Mark your moves →</button>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--marker-mid)', marginTop: 16 }}>marker.work · no card</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(250,247,242,0.4)', marginTop: 12, letterSpacing: '0.04em' }}>
            Illustrative score, based on public review data and employer policy pages.
          </div>
        </div>
      </div>
    </DCArtboard>
  );
}

function AdDisplayMR() {
  return (
    <DCArtboard id="ad-300x250" label="Display · 300×250 (MR)" width={300} height={250}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '20px 22px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        border: '1px solid var(--marker-border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={16} />
          <div className="holo-dot" style={{ width: 10, height: 10, borderRadius: '50%' }} />
        </div>
        <div>
          <div className="display-md" style={{ fontSize: 26, color: 'var(--marker-black)', textWrap: 'balance', lineHeight: 1 }}>
            Mark your<br/>moves.
          </div>
          <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 8, lineHeight: 1.4 }}>
            The job hunt, calmly tracked. Free for 7 days.
          </div>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 11, padding: '7px 12px', alignSelf: 'flex-start' }}>Start free →</button>
      </div>
    </DCArtboard>
  );
}

function AdDisplayLB() {
  return (
    <DCArtboard id="ad-728x90" label="Display · 728×90 (Leaderboard)" width={728} height={90}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-black)', color: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24,
      }}>
        <Logo size={22} color="var(--marker-cream)" />
        <div className="holo-hairline" style={{ flex: '0 0 60px' }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="display-md" style={{ fontSize: 22, color: 'var(--marker-cream)' }}>Mark your moves.</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>For senior people who'd quite like their evenings back.</span>
        </div>
        <button style={{
          background: 'var(--marker-lime)', color: 'var(--marker-black)',
          border: 'none', padding: '10px 18px', borderRadius: 6,
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>Start free →</button>
      </div>
    </DCArtboard>
  );
}

Object.assign(window, {
  AdLinkedIn1, AdLinkedIn2, AdInstagramSquare, AdInstagramStory, AdDisplayMR, AdDisplayLB,
});
