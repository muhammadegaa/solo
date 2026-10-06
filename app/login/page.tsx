import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await getUser()) redirect("/call");
  return (
    <main className="fl fl-start">
      <div className="fl-orb" aria-hidden="true" />
      <h1>Solo</h1>
      <LoginForm />
    </main>
  );
}
