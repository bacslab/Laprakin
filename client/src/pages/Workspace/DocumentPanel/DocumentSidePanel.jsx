import { useDocument } from '../../../state/document-context';

export function DocumentSidePanel({ children, render }) {
  const documentState = useDocument();
  if (render) return render(documentState);
  return children || null;
}

export default DocumentSidePanel;
