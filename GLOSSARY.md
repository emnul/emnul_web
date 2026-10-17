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
A single-pass GLSL fragment program published on the site, together with its title, description, Still, and optional write-up.
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
A static image of a Shader frozen at a moment and Parameter values chosen per Shader, shown in place of live rendering when motion is reduced, WebGL2 is unavailable, the Shader fails to compile, or in the Gallery until interaction.
_Avoid_: Poster, thumbnail, fallback image

**Inputs**:
The values the site supplies to any Shader that declares them: `u_resolution` and `u_time`.
_Avoid_: Uniforms (in prose)

**Parameter**:
A named, typed value a Shader declares, which a visitor adjusts through its Control, starting from its default value.
_Avoid_: Uniform, knob, setting

**Control**:
The on-page widget a visitor uses to change one Parameter, such as a slider or a toggle;
_Avoid_: input

**Shader contract**:
What a Shader may rely on and declare: the Inputs the site supplies, and the Parameter types it may use, each with its GLSL type and Control.
_Avoid_: Spec, interface

## Environments

**Production**:
The live site at emnul.dev, built from `main`.
_Avoid_: Prod, live

**Preview**:
A deployment of the `staging` branch at its own URL, used to review work before it reaches Production.
_Avoid_: Staging

## Planned

**Project**:
A separately deployed portfolio piece that will get a showcase page on the site; not part of v1.
_Avoid_: App, demo
