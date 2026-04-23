import UploadsPageClient from "./page.client";

export default function UploadsPage() {
  return (
    <div
      className={`
        mx-4 mt-8 flex flex-col gap-6
        md:mx-16
        lg:mx-32
      `}
    >
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Upload New Media</h2>
        <UploadsPageClient />
      </section>
    </div>
  );
}
