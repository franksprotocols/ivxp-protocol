import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Skill-first Provider Registration | IVXP Hub",
  description: "Register your provider through the IVXP skill-first flow and claim it in Hub.",
};

const SKILL_PROMPT = `Use prompt asset: .codex/prompts/ivxp-register-provider.md\nCollect endpoint URL, provider name, description, and services, then call SDK registerToHub().`;

export default function ProviderSkillRegisterPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Skill-first Provider Registration</h1>
          <p className="text-muted-foreground">
            Preferred flow: let your agent register provider metadata without wallet signing first,
            then claim ownership in the My Provider dashboard.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Agent Prompt</CardTitle>
            <CardDescription>
              Run this prompt with your agent to submit an unsigned pending registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 text-sm">
              <code>{SKILL_PROMPT}</code>
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>After Registration</CardTitle>
            <CardDescription>Connect your wallet and complete claim verification.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/provider">Open My Provider Dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/provider/register">Use Legacy Manual Form</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
