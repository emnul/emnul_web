// A moiré magnifier: a square array of lenses over a square array of icons whose pitch differs
// slightly. The icon layer sits in the lenses' focal plane and the viewer is far away, so every
// ray through one lens lands on one point of the icon layer, and the whole lens shows that
// point's colour. Neighbouring lenses land on neighbouring points of successive icons, so
// together they draw one icon magnified about 1/(1 − scaleRatio) times.
precision highp float;

uniform vec2 u_resolution;
// Icon pitch over lens pitch. Below 1 the magnified icons are upright and sink below the
// surface; above 1 they are inverted and float above it; at 1 they grow without bound.
uniform float scaleRatio;
// The icon layer turned against the lens layer, in degrees counter-clockwise.
uniform float rotation;
// The icon layer moved right, in icon pitches. One pitch moves the image one moiré period.
uniform float offset;
// How far the viewer has moved to the right of straight on, in degrees.
uniform float viewAngle;
// 0: a letter R, 1: a star, 2: lines in a disc.
uniform int icon;
// Grey noise added to every pixel, as a camera would, with this standard deviation as a fraction
// of white. Each pixel's noise depends on its position alone, so a frame renders the same twice.
uniform float noise;

out vec4 fragColor;

// Design units are pixels of the 1024² frame the detector analyses. Any other frame is scaled to
// its short side, so it shows the same lenses across it.
const float ANALYSIS_SIZE = 1024.0;
// Lens pitch in design units. A whole number, so at 1024² each lens covers exactly 6×6 pixels.
const float LENS_PITCH = 6.0;
// Gap between the layers: the lenses' focal length, in design units (F/1 lenses).
const float FOCAL_LENGTH = 6.0;
// Half the width of an icon's soft edge, in icon pitches: about one step between neighbouring
// lenses' sample points at a scale ratio of 0.95. It stands in for the lens's focused spot.
const float EDGE = 0.02;

const vec3 PAPER = vec3(0.95, 0.93, 0.87);
const vec3 INK = vec3(0.09, 0.14, 0.33);

float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// The icons are signed distances in an icon tile's own coordinates, [-0.5, 0.5)², negative
// inside. None looks the same turned 180°, so an inverted (floating) image reads as one.

// A capital R drawn in strokes.
float letter(vec2 p) {
    float d = segment(p, vec2(-0.17, -0.3), vec2(-0.17, 0.3));
    d = min(d, segment(p, vec2(-0.17, 0.3), vec2(0.02, 0.3)));
    d = min(d, segment(p, vec2(-0.17, 0.0), vec2(0.02, 0.0)));
    // The bowl, the right half of a ring; left of its centre the bars above are nearer.
    vec2 bowl = p - vec2(0.02, 0.15);
    d = min(d, bowl.x > 0.0 ? abs(length(bowl) - 0.15) : 1.0);
    d = min(d, segment(p, vec2(0.0, 0.0), vec2(0.19, -0.3)));
    return d - 0.06;
}

// A five-pointed star, one point up (after Inigo Quilez's sdStar5).
float star(vec2 p) {
    const float r = 0.4;
    const float inner = 0.45;
    const vec2 k1 = vec2(0.809016994, -0.587785252);
    const vec2 k2 = vec2(-k1.x, k1.y);
    // Centres the star's height in the tile.
    p.y += 0.04;
    p.x = abs(p.x);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1;
    p -= 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = inner * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
    float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// Three horizontal bars inside a disc, thinning upwards, each at least about one and a half
// lenses wide at a scale ratio of 0.95. Confined to the disc so the pattern doesn't repeat
// within its tile, which would put a moiré at a fraction of the true period.
float lines(vec2 p) {
    float bars = 1.0;
    for (int i = 0; i < 3; i++) {
        float y = (float(i) - 1.0) * 0.24;
        float halfWidth = 0.085 - 0.025 * float(i);
        bars = min(bars, abs(p.y - y) - halfWidth);
    }
    return max(bars, length(p) - 0.36);
}

float iconDistance(vec2 p) {
    if (icon == 1) return star(p);
    if (icon == 2) return lines(p);
    return letter(p);
}

vec3 shade(vec2 fragCoord) {
    // Centred design units, so at 1024² this is gl_FragCoord.xy − 512.
    vec2 p = (fragCoord - 0.5 * u_resolution) * (ANALYSIS_SIZE / min(u_resolution.x, u_resolution.y));
    // The centre of the lens this point looks through; one lens sits at the centre of the frame.
    vec2 lens = floor(p / LENS_PITCH + 0.5) * LENS_PITCH;
    // A viewer moved right looks down and to the left through each lens, so its focus moves left.
    vec2 focus = lens - vec2(FOCAL_LENGTH * tan(radians(viewAngle)), 0.0);
    float iconPitch = scaleRatio * LENS_PITCH;
    // Into the icon layer's frame: undo its offset, then its rotation about the frame's centre.
    vec2 q = focus - vec2(offset * iconPitch, 0.0);
    float angle = radians(rotation);
    // GLSL fills a mat2 by columns, so this is a rotation by −angle.
    vec2 tile = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * q / iconPitch;
    // Icons are centred on whole tile coordinates, so the centre lens sees an icon's centre.
    vec2 cell = fract(tile + 0.5) - 0.5;
    float ink = 1.0 - smoothstep(-EDGE, EDGE, iconDistance(cell));
    return mix(PAPER, INK, ink);
}

// Jarzynski and Olano's pcg2d: two well-mixed 32-bit integers from two.
uvec2 hash(uvec2 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * 1664525u;
    v.y += v.x * 1664525u;
    v ^= v >> 16u;
    v.x += v.y * 1664525u;
    v.y += v.x * 1664525u;
    v ^= v >> 16u;
    return v;
}

// A standard normal value for a pixel, by the Box–Muller transform of two uniform ones.
float gaussian(uvec2 pixel) {
    // The top 24 bits of each, which a float holds exactly: u1 in (0, 1], so its log is finite.
    uvec2 bits = hash(pixel) >> 8u;
    float u1 = (float(bits.x) + 1.0) / 16777216.0;
    float u2 = float(bits.y) / 16777216.0;
    return sqrt(-2.0 * log(u1)) * cos(6.28318530718 * u2);
}

void main() {
    // 2×2 samples per pixel smooth lens edges that fall inside a pixel. At 1024² every lens edge
    // is a pixel edge, so there they change nothing.
    vec3 colour = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        vec2 sub = vec2(float(i & 1), float(i >> 1)) * 0.5 - 0.25;
        colour += shade(gl_FragCoord.xy + sub);
    }
    colour = colour / 4.0 + noise * gaussian(uvec2(gl_FragCoord.xy));
    fragColor = vec4(colour, 1.0);
}
