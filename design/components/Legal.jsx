// Reusable legal attribution components — minimum compliant sizes.
// AdzunaBadge: 116x23px (Adzuna API ToS minimum). Renders as a chip.
// AIDisclaimer: small caption shown near AI-generated score data.
// OGLLine: Gov.uk OGL v3.0 attribution.

function AdzunaBadge() {
  return (
    <span className="adzuna-badge" title="Jobs by Adzuna">
      <span style={{ opacity: 0.6, marginRight: 4 }}>jobs by</span>
      <span style={{ fontWeight: 500, letterSpacing: '0.04em' }}>ADZUNA</span>
    </span>
  );
}

function AIDisclaimer({ light = false }) {
  return (
    <span className="legal-line" style={{ color: light ? 'rgba(250,247,242,0.45)' : undefined }}>
      AI-generated estimates from public data. Not professional career advice.
    </span>
  );
}

function OGLLine({ light = false }) {
  return (
    <span className="legal-line" style={{ color: light ? 'rgba(250,247,242,0.45)' : undefined }}>
      Contains public sector information licensed under the Open Government Licence v3.0.
    </span>
  );
}

function ReviewDataLine({ light = false }) {
  return (
    <span className="legal-line" style={{ color: light ? 'rgba(250,247,242,0.45)' : undefined }}>
      WLB scores aggregated from public employee review data. See methodology.
    </span>
  );
}

Object.assign(window, { AdzunaBadge, AIDisclaimer, OGLLine, ReviewDataLine });
