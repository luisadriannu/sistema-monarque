import Image from "next/image";

export default function InvitationQrPass({ image, guestName, passes }: { image: string; guestName: string; passes: number }) {
  return <section className="relative overflow-hidden bg-[#183126] px-5 py-20 text-center text-[#f5eddc]">
    <div className="pointer-events-none absolute inset-4 rounded-[2.5rem] border border-[#c7aa67]/35" />
    <div className="relative mx-auto max-w-md"><p className="text-xs font-bold uppercase tracking-[.35em] text-[#c7aa67]">Pase de entrada</p><h2 className="mt-4 font-serif text-4xl">Tu acceso al evento</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#f5eddc]/70">Presenta este código al equipo de recepción. Es personal y registra hasta {passes} {passes === 1 ? "acceso" : "accesos"}.</p>
      <div className="mx-auto mt-8 w-fit rounded-[2rem] bg-[#fffaf0] p-5 shadow-2xl shadow-black/30"><Image src={image} alt={`Código QR de entrada para ${guestName}`} width={240} height={240} unoptimized className="h-56 w-56"/></div>
      <p className="mt-5 font-serif text-2xl">{guestName}</p><p className="mt-1 text-[10px] uppercase tracking-[.25em] text-[#c7aa67]">No compartas este código</p>
    </div>
  </section>;
}
