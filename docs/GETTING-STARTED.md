# Cast & Scene: Getting Started Guide

## Welcome to Cast & Scene

Cast & Scene is a system-agnostic module for Game Masters who want to
enrich Theatre of the Mind by bringing the characters of their
adventures onto the scene.

Instead of relying on a battlemap for every narrative moment, you can
prepare a cast of characters, arrange them on screen and control their
presentation during play. Camera Focus, background effects, silhouette
reveals and other tools can help give important conversations and
dramatic moments greater visual and emotional impact.

This guide will take you from an empty Cast & Scene setup to your first
playable scene.

## 1. Open Cast & Scene

After enabling the module, Cast & Scene adds its controls to Foundry
VTT.

The main workflow revolves around three core tools:

**Character Pool → Scene Presets → Quick Access**

**Character Pool** contains the characters you want to reuse.

**Scene Presets** let you prepare casts and their presentation in
advance.

**Quick Access** is the compact menu designed for use during play,
giving you immediate access to the presentation controls you are most
likely to need without keeping the main Cast & Scene windows open.

## 2. Build your Character Pool

The **Character Pool** is your library of characters and the starting
point for every character you want to use in Cast & Scene.

Create a character and assign an image to it. All characters must first
be created in the Character Pool before they can be added to a Scene
Preset.

Whether a character is intended for a single appearance or will return
throughout an entire campaign, it always begins in the Character Pool.
Scene Presets then use the characters you have already created here.

This keeps your characters separate from the scenes in which they are
used and allows the same Character Pool entry to be reused across
multiple Scene Presets when needed.

### Character Variants

A character can have multiple image variants.

Variants allow you to keep different visual versions of the same
character together rather than creating separate Character Pool entries.

For example, an NPC could have a neutral image, a smiling image and an
angry image. Variants can also represent much larger changes. A
character who transforms into a monster could have their normal
appearance and transformed appearance stored as variants of the same
character.

This gives you a quick way to change how a character appears during a
scene while keeping all of their visual states organized in a single
Character Pool entry.

### Image Performance

Cast & Scene is a visual module, so image size matters. Large character
images consume more texture memory and can increase loading time for
your players.

WebP images are generally a good choice when preparing characters for
Cast & Scene. The built-in Performance Monitor can help identify
presentations that may be becoming too demanding.

## 3. Create a Scene Preset

**Scene Presets** let you prepare groups of characters and their visual
arrangement before presenting them during play.

Create a Scene Preset and add characters from your Character Pool.

When a character is first added, it retains the visual settings and
scale defined in the Character Pool. Once inside the Scene Preset,
however, you can adjust its position, scale and presentation
specifically for that preset without modifying the original character
stored in the Character Pool.

This means that the same character can be reused across many Scene
Presets with a different arrangement in each one.

For example, a recurring villain might appear prominently in the center
of one Scene Preset and stand beside several allies in another. These
changes remain specific to each Scene Preset.

### Linking Presets to Foundry Scenes

Scene Presets can be linked to specific Foundry Scenes.

This allows you to prepare casts according to the locations, encounters
or situations in which they are likely to appear.

For example, a Foundry Scene representing a tavern could have several
Cast & Scene presets prepared for the innkeeper and patrons, an
important conversation or a group of unexpected visitors.

Linking presets to a Foundry Scene also affects how they are presented
in Quick Access, allowing the material relevant to your current Scene to
be prioritized during play.

## 4. Prepare Camera Focus

Cast & Scene can give individual characters their own **Camera Focus**.

Select a character and define the **Zoom Frame** you want to use. During
play, Camera Focus can then move the presentation toward that character
using the framing you prepared.

This is useful when an NPC begins an important speech, reveals something
unexpected or simply deserves a little more dramatic attention.

Camera Focus is calculated independently on each connected client so
that players with different screen sizes receive an appropriate framing.

## 5. Present your Scene Preset

Once a Scene Preset is ready, you can use it during the game.

Characters can be shown or hidden individually, allowing you to control
entrances, exits and changes in the current presentation without
removing characters from the Scene Preset.

The layout you prepared becomes the basis of the presentation, while the
individual visibility and presentation controls allow you to react to
what happens during play.

You do not need to keep the Scene Presets interface open while running
the scene. This is the purpose of **Quick Access**.

## 6. Quick Access

**Quick Access** is the compact floating menu designed for use during
the session.

It gives you immediate access to the Cast & Scene controls you are most
likely to need without requiring you to keep the Character Pool or Scene
Presets interfaces open.

### Scene-linked Presets

When you are on a Foundry Scene that has linked Scene Presets, **those
presets are given priority in Quick Access and are presented before the
other available presets**.

This means you can prepare the characters you expect to use while
planning a scene, link their presets to that Foundry Scene and have them
immediately available when you load it during the game.

For example, if you prepare several Cast & Scene presets for a tavern
and link them to the corresponding Foundry Scene, opening that Scene
will place those presets at the front of Quick Access.

The characters and casts you prepared for that location are therefore
ready to use without searching through your entire collection of
presets.

Presets that are not linked to the current Foundry Scene remain
available, but scene-linked presets are prioritized.

### Presentation Controls

Quick Access also gives you immediate control over frequently used
presentation features, including character visibility, character names,
Camera Focus, Camera Reset and Silhouette.

The intended workflow is therefore:

**Build your characters in Character Pool → Prepare casts with Scene
Presets → Link relevant presets to Foundry Scenes → Load the Scene →
Find its presets prioritized in Quick Access → Run your presentation**

## 7. Camera Focus During Play

When **Camera Focus** is activated, Cast & Scene uses the Zoom Frame
prepared for that character and moves the presentation toward them.

This allows you to direct the players' attention toward a particular
character without permanently changing the layout prepared in the Scene
Preset.

Camera controls can then be used to return to the normal presentation.

Because Camera Focus adapts to the viewport of each connected client,
different screen resolutions and aspect ratios do not need to use an
identical fixed camera position.

## 8. Background Effects

Cast & Scene provides background effects that can help direct attention
toward the characters.

The available presentation options include:

-   **Dim**
-   **Blur**
-   **Focus**, combining Dim and Blur

Effect intensity can also be adjusted.

These effects are presentation tools. They do not permanently alter the
underlying Foundry Scene.

They can be used to reduce visual distractions during dialogue,
emphasize the currently presented cast or reinforce a Camera Focus
moment.

Stronger blur effects require more GPU resources. If performance becomes
an issue, reducing blur intensity is one of the first things to try.

## 9. Silhouette Reveals

**Silhouette** can conceal a character's appearance while still allowing
the character to occupy their prepared position in the scene.

Silhouette can be enabled before revealing a character, allowing them to
enter the presentation while their identity or appearance remains
concealed.

When Silhouette is removed, Cast & Scene performs an animated reveal.

This can be useful for unknown NPCs, surprise appearances,
transformations or dramatic introductions.

## 10. Performance Monitor

Cast & Scene includes a **Performance Monitor** because visual
presentations can become demanding when many large images and effects
are used simultaneously.

The Performance Monitor provides an estimate of how demanding the
current preset may be.

It considers factors such as image transfer size, texture memory,
visible portrait load and background-effect cost.

The monitor is not a benchmark of your computer or your players'
computers. It is intended as a practical warning system while building
scenes.

If a preset becomes particularly heavy, consider:

-   reducing portrait image dimensions;
-   using efficient image formats such as WebP;
-   limiting the number of simultaneously visible portraits;
-   reducing the intensity of Blur effects.

The goal is not necessarily to keep every indicator at its minimum, but
to help you recognize when a particularly elaborate presentation may
become unnecessarily demanding for connected players.

## 11. Changing Foundry Scenes

Cast & Scene distinguishes between a GM **viewing** another Foundry
Scene and actually **activating** that Scene.

If the GM simply previews another Scene, Cast & Scene hides the
presentation locally for the GM while the players continue seeing the
current shared presentation.

This allows the GM to inspect or prepare another Foundry Scene without
unexpectedly interrupting what the players are currently seeing.

When the GM activates a different Foundry Scene, Cast & Scene clears the
shared presentation for everyone. Visible characters are switched off,
Camera Focus is reset and the live background state is cleared.

Your **Character Pool** and saved **Scene Presets** are not deleted.

## 12. Your First Cast & Scene Presentation

You do not need to learn every feature before using Cast & Scene.

For a first test, try this:

1.  Open **Character Pool**.
2.  Create two characters and assign their images.
3.  Give one of them a second image variant.
4.  Create a **Scene Preset**.
5.  Add both characters from your Character Pool.
6.  Position and scale their images.
7.  Link the Scene Preset to your current Foundry Scene.
8.  Prepare **Camera Focus** for one character.
9.  Open **Quick Access** and find the linked preset among the
    prioritized presets.
10. Show and hide one character.
11. Try changing a character variant.
12. Activate Camera Focus on the other character.
13. Try **Dim**, **Blur** or **Focus** on the background.
14. Try a **Silhouette** reveal.
15. Reset the Camera.

At this point you have already used most of the tools needed to run a
basic Cast & Scene presentation.

From here, you can build more elaborate Scene Presets and combine these
tools according to the needs of your game.

## Known Issue: Responsive Portrait Spacing

Portrait positioning may appear slightly different between displays with
substantially different viewport sizes or aspect ratios.

Camera Focus uses normalized positioning and adapts independently to
each client's viewport, but the apparent spacing between portraits can
still vary.

This is a known limitation of Cast & Scene 1.0.0 and does not affect
saved Character Pool or Scene Preset data.

## Community and Support

Cast & Scene 1.0.0 is free to use.

If you would like to follow development, future modules and updates, you
can join the Dungeon Maxter community on Patreon.

[**Join Dungeon Maxter on
Patreon**](https://www.patreon.com/cw/DungeonMaxter)
