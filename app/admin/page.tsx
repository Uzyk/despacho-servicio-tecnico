import { AuthGate } from "@/components/AuthGate";
import { AdminPeople } from "@/components/AdminPeople";

export default function Page() {
  return (
    <AuthGate roles={["admin"]}>
      <AdminPeople />
    </AuthGate>
  );
}
