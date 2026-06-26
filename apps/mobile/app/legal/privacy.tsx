import { LegalView } from '@/ui/LegalView';
import { PRIVACY_POLICY } from '@/legal/content';

export default function PrivacyScreen() {
  return <LegalView doc={PRIVACY_POLICY} />;
}
