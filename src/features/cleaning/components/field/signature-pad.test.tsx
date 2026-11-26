import { fireEvent, render, screen } from '@testing-library/react';
import { SignaturePad } from './signature-pad';

/** Contexte 2D simulé : jsdom n'a pas de `canvas`. */
function stubCanvas() {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  };
  const png = new Blob(['png'], { type: 'image/png' });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback: BlobCallback) => callback(png));
  return { context, png, toBlob };
}

afterEach(() => vi.restoreAllMocks());

describe('signature du client', () => {
  it('trait au doigt : image PNG remise à la clôture ; « Effacer » la retire', () => {
    const { context, png, toBlob } = stubCanvas();
    const onChange = vi.fn();
    render(<SignaturePad id="signature" onChange={onChange} />);

    const pad = screen.getByRole('img', { name: 'Cadre de signature vide' });
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeDisabled();
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });

    expect(context.lineTo).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(onChange).toHaveBeenLastCalledWith(png);
    expect(screen.getByRole('img', { name: 'Signature prise' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('img', { name: 'Cadre de signature vide' })).toBeInTheDocument();
  });

  it('désactivée pendant l’envoi : aucun trait', () => {
    const { toBlob } = stubCanvas();
    const onChange = vi.fn();
    render(<SignaturePad id="signature" onChange={onChange} disabled />);
    const pad = screen.getByRole('img', { name: 'Cadre de signature vide' });
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(toBlob).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sans canvas : l’écran le dit, la clôture se fait sans signature', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<SignaturePad id="signature" onChange={vi.fn()} />);
    expect(
      screen.getByText('Signature impossible sur ce téléphone : clôturez sans signature.'),
    ).toBeInTheDocument();
  });
});
