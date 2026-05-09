# Challenge levels

Palmprint has four level presets. The level controls the default challenge style, test count, simultaneous prompt count, and prompt rotation speed.

| Level value | Label | Default style | Default tests | What changes |
|---|---|---|---:|---|
| `low` | Easy | `standard` | 2 | Single hand or face prompt. |
| `medium` | Medium | `handedness` | 2 | Adds left/right hand requirements to hand prompts. |
| `high` | Hard | `temporal` | 3 | Adds ordered prompts, such as Thumbs Up then Thumbs Down. |
| `extra` | Extra Hard | `max` | 4 | Combines temporal prompts, left/right hands, two-hand prompts, and face prompts. |

You can override the style directly with `challengeStyle`, but the level presets are the recommended defaults.

## Challenge styles

| Style | Meaning |
|---|---|
| `standard` | Random canned MediaPipe hand gestures and Palmprint face expressions. |
| `handedness` | Hand prompts can require a specific left or right hand. |
| `two-hand` | Requires two simultaneous hand gestures; `mode="both"` also adds one face prompt. |
| `temporal` | Requires ordered phases inside one step, for example Thumbs Up then Thumbs Down. |
| `max` | Extra-hard mode: ordered phases, handedness, two hands, and a face prompt in `mode="both"`. |

## Combination counts

These counts use the default `mode="both"` and the built-in pools:

- 7 canned hand gestures: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou`
- 5 face prompts: smile, mouth open, wink left, wink right, brows up
- 2 hand sides: left and right

| Level | Per phase | Per step | Default run |
|---|---:|---:|---:|
| Easy | 12 | 12 | 144 |
| Medium | 70 | 70 | 4,900 |
| Hard | 12 | 132 | 2,299,968 |
| Extra Hard | 420 | 73,735,620 | 29,560,334,579,277,496,406,548,083,360,000 |

The largest supported configuration is Extra Hard with `numTests={7}`:

```txt
420 phase combinations
420 * 419 * 419 = 73,735,620 ordered combinations per step
73,735,620 ^ 7 =
11,850,627,694,441,694,265,066,735,797,450,568,802,994,769,742,080,000,000
```

That is about `1.185e55` possible full-run prompt sequences.

## Security note

The combination count measures prompt diversity: how many live challenge sequences an attacker may need to predict or synthesize. It is not cryptographic entropy and it does not replace server-side token verification, replay protection, origin controls, rate limits, or capture/liveness review for high-risk deployments.

The server SDK still enforces the signed challenge flow with required level and required step count. The browser handles the real-time gesture matching and emits a client token only after the ordered prompts are completed.
