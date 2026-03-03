import Mustache from "mustache";
import type { InputBinding } from "@/lib/types";

function resolveDynamicToken(token: string): string {
  switch (token) {
    case "$string.uuid":
      return crypto.randomUUID();
    case "$date.now":
      return new Date().toISOString();
    default:
      return `{{${token}}}`;
  }
}

function injectDynamicValues(text: string): string {
  return text.replace(/{{\s*(\$[a-zA-Z0-9_.]+)\s*}}/g, (_, token: string) => resolveDynamicToken(token));
}

export function buildVariables(row: Record<string, unknown>, bindings: InputBinding[]) {
  const vars: Record<string, unknown> = {};
  for (const binding of bindings) {
    vars[binding.placeholder] = row[binding.column];
  }
  vars.input = row;
  return vars;
}

export function renderRequestTemplate(template: string, variables: Record<string, unknown>) {
  const rendered = Mustache.render(injectDynamicValues(template), variables);
  try {
    return JSON.parse(rendered);
  } catch {
    return rendered;
  }
}

export function renderHeaderTemplate(
  headerTemplate: Record<string, string>,
  variables: Record<string, unknown>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(headerTemplate)) {
    headers[key] = Mustache.render(injectDynamicValues(String(value ?? "")), variables);
  }
  return headers;
}
