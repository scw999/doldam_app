import { LegalView } from '@/ui/LegalView';
import { TERMS_OF_SERVICE } from '@/legal/content';

export default function TermsScreen() {
  return <LegalView doc={TERMS_OF_SERVICE} />;
}
