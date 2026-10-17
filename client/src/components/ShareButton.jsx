import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

// Shares the app: the phone's share sheet when available, otherwise the link is copied.
// A committee rep also shares the building code, so neighbours can join straight away.
export default function ShareButton({ inviteCode, buildingName, className = 'btn btn--secondary btn--small', label = 'שיתוף האפליקציה', iconSize = 16 }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.origin;
    const text = buildingName && inviteCode
      ? `הצטרפו אלינו לניהול הבניין "${buildingName}" באפליקציית ועד בית. קוד בניין: ${inviteCode}`
      : 'ועד בית - ניהול עצמי נוח לבניין ולמתחם';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ועד בית', text, url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // the user closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <button type="button" className={className} onClick={share}>
      {copied ? <Check size={iconSize} /> : <Share2 size={iconSize} />} {copied ? 'הקישור הועתק' : label}
    </button>
  );
}
