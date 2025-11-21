import PaymentForm from "@/components/PaymentForm";
import DarkModeToggle from "@/components/DarkModeToggle";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <DarkModeToggle />
      <PaymentForm />
    </div>
  );
}

