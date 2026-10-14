# emnul.dev

A personal site that is both a developer journal and a portfolio, with live GLSL shaders as its centerpiece.

## Content

**Post**:
A dated written entry in the developer journal.
_Avoid_: Article, blog entry

**Draft**:
A Post or Shader marked as not ready; it appears in local dev and on Previews, never in Production.
_Avoid_: Unpublished, WIP

**Shader**:
A single-pass, Shadertoy-compatible fragment program published on the site, together with its title, description, Still, and optional write-up.
_Avoid_: Sketch, creation, demo

**Write-up**:
The optional prose shown beneath a Shader on its own page, explaining how it works.
_Avoid_: Notes, description

**Featured**:
A Shader chosen to appear on the home page.
_Avoid_: Pinned, highlighted

## Presentation

**Gallery**:
The page listing every published Shader.
_Avoid_: Showcase, portfolio

**Embed**:
A Shader shown live inside a Post, referenced by its slug.
_Avoid_: Inline shader, widget

**Still**:
A static image of a Shader frozen at a moment chosen per Shader, shown in place of live rendering when motion is reduced, WebGL2 is unavailable, the Shader fails to compile, or in the Gallery until interaction.
_Avoid_: Poster, thumbnail, fallback image

**Inputs**:
The Shadertoy-named values the site supplies to every Shader (`iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iDate`).
_Avoid_: Uniforms (in prose)

## Environments

**Production**:
The live site at emnul.dev, built from `main`.
_Avoid_: Prod, live

**Preview**:
A deployment of any non-`main` branch at its own URL, used to review work before it reaches Production.
_Avoid_: Staging

## Planned

**Editor**:
The planned live shader editor, where a visitor can modify and run a Shader in the browser.
_Avoid_: Playground, sandbox

**Project**:
A separately deployed portfolio piece that will get a showcase page on the site; not part of v1.
_Avoid_: App, demo
