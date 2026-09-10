import { AuthGate } from "@/components/AuthGate";
import { ProfileForm } from "@/components/ProfileForm";

export default function Page() {
  return (
    <AuthGate roles={["admin", "jefatura", "tecnico"]}>
      <ProfileForm />
    </AuthGate>
  );
}
