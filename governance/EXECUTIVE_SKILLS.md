# Executive Skills™ (Reserved)

ATHENA™ Phase 3E — Board Directive #3 (Layer Two: Knowledge Layer™). **Status: reserved. No implementation this phase.**

## What it would be

Reusable business-expert modules sitting above the Capability Registry™: Publishing Advisor™, Royalty Advisor™, Metadata Advisor™, Distribution Advisor™, Marketing Advisor™, Release Strategy Advisor™, Copyright Advisor™, Catalog Advisor™, Media Advisor™ — each providing structured business expertise independent of the LLM, consumed by providers but never replaced by them.

## Why this is reserved, not built, in Phase 3E

Confirmed directly with the Board this session. A Skill, as described, would sit in the same conceptual position as a Capability Registry module — structured, pre-LLM business knowledge — without a clear, testable distinction between "what a Capability provides" and "what a Skill provides" until there's a real (non-placeholder) AI provider to demonstrate why a second layer is needed. Building it now, against `providers/placeholder-provider.js`'s zero-external-call template composer, risks becoming a second data-access path that duplicates the Capability Registry — exactly what "no layer duplicates another" forbids.

Today, the Capability Registry's 11 domain modules (`api/athena/ask/capabilities/`) already provide the structured, per-domain evidence and context every Skill would need as its own foundation.

## When to build it

Once a real AI provider is configured and Ask ATHENA has live usage data showing where a Capability's raw evidence needs additional structured business reasoning *before* it reaches the LLM (not just formatting, but genuine domain expertise — e.g. "given this publishing gap, which specific registration body applies in this territory"), build the first Skill as a thin layer on top of the relevant Capability, not a replacement for it.
