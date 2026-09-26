import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "bear", "bear.blend")
GLB = os.path.join(ROOT, "public", "models", "bear.glb")

TARGET_TRIS = 3200
MIN_TRIS = 2500
MAX_TRIS = 4000
VOXEL_SIZE = 0.018

FPS = 30
STRIDE_LENGTH = 0.7
WALK_DURATION = 1.2
WALK_FRAMES = 36
IDLE_FRAMES = 120
DUTY = 0.58
LIFT = 0.07
PAW_Z = 0.07
LEGS = [
    ("HL", 0.0, 0.56),
    ("FL", 0.25, -0.45),
    ("HR", 0.5, 0.56),
    ("FR", 0.75, -0.45),
]

BODY = [
    ("torso", (0, -0.10, 0.66), (0.30, 0.55, 0.30), (0, 0, 0)),
    ("rump", (0, 0.50, 0.66), (0.30, 0.32, 0.30), (0, 0, 0)),
    ("hump", (0, -0.42, 0.78), (0.30, 0.26, 0.22), (0, 0, 0)),
    ("belly", (0, 0.05, 0.48), (0.24, 0.40, 0.14), (0, 0, 0)),
    ("neck", (0, -0.72, 0.78), (0.18, 0.20, 0.18), (-15, 0, 0)),
    ("skull", (0, -0.92, 0.80), (0.165, 0.175, 0.155), (0, 0, 0)),
    ("muzzle_base", (0, -1.05, 0.755), (0.09, 0.10, 0.08), (0, 0, 0)),
    ("tail", (0, 0.82, 0.74), (0.04, 0.05, 0.04), (20, 0, 0)),
    ("back", (0, 0.12, 0.72), (0.29, 0.62, 0.26), (0, 0, 0)),
    ("withers", (0, -0.60, 0.76), (0.24, 0.22, 0.21), (-8, 0, 0)),
    ("chest", (0, -0.50, 0.56), (0.24, 0.20, 0.20), (0, 0, 0)),
]

for s in (1, -1):
    BODY += [
        ("front_upper", (s * 0.17, -0.45, 0.42), (0.10, 0.115, 0.21), (0, 0, 0)),
        ("front_lower", (s * 0.17, -0.46, 0.17), (0.08, 0.088, 0.15), (-6, 0, 0)),
        ("front_paw", (s * 0.17, -0.53, 0.035), (0.08, 0.11, 0.035), (0, 0, s * 8)),
        ("hind_upper", (s * 0.18, 0.55, 0.50), (0.11, 0.16, 0.24), (8, 0, 0)),
        ("hind_lower", (s * 0.17, 0.60, 0.18), (0.07, 0.08, 0.15), (-10, 0, 0)),
        ("hind_paw", (s * 0.17, 0.54, 0.035), (0.075, 0.14, 0.035), (0, 0, s * 4)),
    ]

DETAILS = [
    ("muzzle", (0, -1.10, 0.74), (0.075, 0.13, 0.07), (0, 0, 0), 2),
    ("nose", (0, -1.225, 0.755), (0.035, 0.025, 0.028), (0, 0, 0), 1),
]
for s in (1, -1):
    DETAILS += [
        ("ear", (s * 0.115, -0.90, 0.955), (0.06, 0.026, 0.066), (-10, 0, s * -15), 1),
        ("eye", (s * 0.078, -1.065, 0.845), (0.018, 0.013, 0.016), (0, 0, 0), 1),
    ]
    for i in range(5):
        dx = (i - 2) * 0.03
        DETAILS.append(("claw", (s * 0.17 + dx, -0.625 + abs(i - 2) * 0.012, 0.02), (0.012, 0.03, 0.011), (-20, 0, 0), 1))
        DETAILS.append(("claw", (s * 0.17 + dx * 0.9, 0.405 + abs(i - 2) * 0.01, 0.018), (0.011, 0.024, 0.01), (-20, 0, 0), 1))

BONES = [
    ("root", (0, 0, 0), (0, -0.25, 0), None, 0.0, False),
    ("spine", (0, 0.62, 0.68), (0, -0.50, 0.76), "root", 0.34, False),
    ("neck", (0, -0.50, 0.76), (0, -0.80, 0.80), "spine", 0.20, True),
    ("head", (0, -0.80, 0.80), (0, -1.23, 0.76), "neck", 0.15, True),
]
for side, s in (("L", 1), ("R", -1)):
    x = s * 0.17
    xh = s * 0.18
    BONES += [
        (f"leg_F{side}_upper", (x, -0.45, 0.64), (x, -0.34, 0.34), "spine", 0.13, False),
        (f"leg_F{side}_lower", (x, -0.34, 0.34), (x, -0.47, 0.07), f"leg_F{side}_upper", 0.11, True),
        (f"leg_F{side}_paw", (x, -0.47, 0.07), (x, -0.63, 0.05), f"leg_F{side}_lower", 0.07, True),
        (f"leg_H{side}_upper", (xh, 0.52, 0.72), (xh, 0.42, 0.38), "spine", 0.12, False),
        (f"leg_H{side}_lower", (xh, 0.42, 0.38), (s * 0.17, 0.60, 0.07), f"leg_H{side}_upper", 0.08, True),
        (f"leg_H{side}_paw", (s * 0.17, 0.60, 0.07), (s * 0.17, 0.42, 0.05), f"leg_H{side}_lower", 0.07, True),
    ]

TORSO_SCALE = 0.9
NECK_Y = -0.6
TORSO_PARTS = {"torso", "rump", "hump", "belly", "back", "withers", "chest"}


def fy(y):
    return y * TORSO_SCALE if y >= NECK_Y else NECK_Y * TORSO_SCALE + (y - NECK_Y)


def fv(v):
    return (v[0], fy(v[1]), v[2])


BODY = [(n, fv(c), (r[0], r[1] * (TORSO_SCALE if n in TORSO_PARTS else 1), r[2]), rot) for n, c, r, rot in BODY]
DETAILS = [(n, fv(c), r, rot, sub) for n, c, r, rot, sub in DETAILS]
BONES = [(n, fv(h), fv(t), p, r, c) for n, h, t, p, r, c in BONES]
LEGS = [(n, o, fy(c)) for n, o, c in LEGS]


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


PAL = {k: srgb(v) for k, v in {
    "coat": "#1E1A18",
    "sheen": "#2E2723",
    "shadow": "#141110",
    "muzzle": "#8A6A4A",
    "muzzle_mid": "#5C4633",
    "nose": "#0E0C0C",
    "eye": "#1A0F08",
    "inner_ear": "#3A2E28",
    "claw": "#3A342E",
    "pad": "#2A2220",
}.items()}


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(4))


def add_ellipsoid(bm, center, radii, rot, subdiv):
    m = Matrix.Translation(center) @ Euler([math.radians(r) for r in rot], "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*radii, 1.0))
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0, matrix=m)


def mesh_from_parts(name, parts, subdiv):
    bm = bmesh.new()
    for p in parts:
        add_ellipsoid(bm, p[1], p[2], p[3], p[4] if len(p) > 4 else subdiv)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def apply_modifier(ob, mod):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.remove(mod)
    ob.data = me
    bpy.data.meshes.remove(old)


def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def body_color(c, n):
    x, y, z = c
    col = mix(PAL["coat"], PAL["sheen"], (n.z - 0.3) / 0.7 * (1 if z > 0.6 else 0.4))
    if z < 0.55:
        col = mix(col, PAL["shadow"], (0.55 - z) / 0.35)
    if n.z < -0.5 and z < 0.12:
        col = PAL["pad"]
    if y < fy(-0.98):
        col = mix(col, PAL["muzzle_mid"], (fy(-0.98) - y) / 0.06)
    return col


def detail_color(name):
    return {
        "muzzle": PAL["muzzle"],
        "nose": PAL["nose"],
        "eye": PAL["eye"],
        "claw": PAL["claw"],
    }.get(name)


def paint(ob, fn):
    me = ob.data
    attr = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    for p in me.polygons:
        col = fn(p)
        for li in p.loop_indices:
            attr.data[li].color = col
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0
    for p in me.polygons:
        p.use_smooth = False


def make_material():
    mat = bpy.data.materials.new("BearVertexColor")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    ca.location = (-300, 200)
    nt.links.new(ca.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.92
    return mat


def build_body():
    ob = mesh_from_parts("BearBody", BODY, 3)
    rm = ob.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = VOXEL_SIZE
    rm.adaptivity = 0.0
    apply_modifier(ob, rm)
    sm = ob.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.9
    sm.iterations = 12
    apply_modifier(ob, sm)
    base = ob.data.copy()
    tris = tri_count(base)
    ratio = TARGET_TRIS / max(tris, 1)
    for _ in range(6):
        work = base.copy()
        old = ob.data
        ob.data = work
        if old is not base:
            bpy.data.meshes.remove(old)
        dm = ob.modifiers.new("Decimate", "DECIMATE")
        dm.decimate_type = "COLLAPSE"
        dm.ratio = min(1.0, ratio)
        dm.use_collapse_triangulate = True
        apply_modifier(ob, dm)
        t = tri_count(ob.data)
        if MIN_TRIS <= t <= MAX_TRIS:
            break
        ratio *= TARGET_TRIS / max(t, 1)
    bpy.data.meshes.remove(base)
    paint(ob, lambda p: body_color(p.center, p.normal))
    return ob


def detail_bone(name, center):
    if name != "claw":
        return "head"
    return f"leg_{'F' if center[1] < 0 else 'H'}{'L' if center[0] > 0 else 'R'}_paw"


def build_details():
    bm = bmesh.new()
    tags = []
    vbones = []
    for p in DETAILS:
        before = len(bm.faces)
        vbefore = len(bm.verts)
        add_ellipsoid(bm, p[1], p[2], p[3], p[4])
        bm.faces.ensure_lookup_table()
        tags += [p[0]] * (len(bm.faces) - before)
        vbones += [detail_bone(p[0], p[1])] * (len(bm.verts) - vbefore)
    me = bpy.data.meshes.new("BearDetails")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("BearDetails", me)
    bpy.context.scene.collection.objects.link(ob)

    def fn(p):
        name = tags[p.index]
        if name == "ear":
            return PAL["inner_ear"] if p.normal.y < -0.3 else PAL["coat"]
        if name == "muzzle":
            return PAL["muzzle_mid"] if p.center.y > fy(-1.02) or p.normal.z > 0.7 else PAL["muzzle"]
        return detail_color(name)

    paint(ob, fn)
    groups = {b[0]: ob.vertex_groups.new(name=b[0]) for b in BONES}
    for i, name in enumerate(vbones):
        groups[name].add([i], 1.0, "REPLACE")
    return ob


def segment_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def weight_body(ob):
    segs = [(b[0], Vector(b[1]), Vector(b[2]), b[4]) for b in BONES if b[4] > 0]
    groups = {b[0]: ob.vertex_groups.new(name=b[0]) for b in BONES}
    for v in ob.data.vertices:
        p = v.co
        scores = []
        for name, a, b, r in segs:
            if name.startswith("leg_"):
                side = 1 if name[5] == "L" else -1
                if p.x * side < -0.02:
                    continue
            d = segment_distance(p, a, b)
            scores.append(((r / (d + 1e-4)) ** 4, name))
        scores.sort(key=lambda s: (-s[0], s[1]))
        top = scores[:4]
        total = sum(s[0] for s in top)
        for w, name in top:
            groups[name].add([v.index], w / total, "REPLACE")


def build_armature():
    arm = bpy.data.armatures.new("BearRig")
    ob = bpy.data.objects.new("BearRig", arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent, _, connect in BONES:
        eb = arm.edit_bones.new(name)
        eb.head = head
        eb.tail = tail
        eb.roll = 0.0
        eb.use_deform = name != "root"
        if parent:
            eb.parent = arm.edit_bones[parent]
            eb.use_connect = connect
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def smoothstep(t):
    return t * t * (3 - 2 * t)


def walk_target(leg, phase_offset, center, t):
    half = STRIDE_LENGTH * DUTY / 2
    ph = (t + phase_offset) % 1.0
    if ph < DUTY:
        s = ph / DUTY
        return center - half + 2 * half * s, PAW_Z
    s = (ph - DUTY) / (1 - DUTY)
    return center + half - 2 * half * smoothstep(s), PAW_Z + LIFT * math.sin(math.pi * s)


def solve_two_bone(h, w, l1, l2, knee_back):
    dy, dz = w[0] - h[0], w[1] - h[1]
    d = math.hypot(dy, dz)
    d = max(abs(l1 - l2) + 1e-4, min(d, (l1 + l2) * 0.9995))
    uy, uz = dy / math.hypot(dy, dz), dz / math.hypot(dy, dz)
    a = math.acos(max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    cands = []
    for sa in (a, -a):
        cy = uy * math.cos(sa) - uz * math.sin(sa)
        cz = uy * math.sin(sa) + uz * math.cos(sa)
        cands.append((h[0] + cy * l1, h[1] + cz * l1))
    knee = max(cands) if knee_back else min(cands)
    return knee, (h[0] + uy * d, h[1] + uz * d)


def yz_angle(v):
    return math.atan2(v[1], v[0])


def pose_bone_to(pb, head, angle):
    rest = pb.bone.matrix_local
    rh = rest.translation
    pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(angle, 4, "X") @ Matrix.Translation(-rh) @ rest


def pose_frame(rig, spine_offset, spine_pitch, neck_rot, head_rot, targets):
    pbs = rig.pose.bones
    for pb in pbs:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    spine = pbs["spine"]
    sh = spine.bone.matrix_local.translation.copy()
    spine_m = Matrix.Translation(sh + Vector(spine_offset)) @ Matrix.Rotation(spine_pitch, 4, "X") @ Matrix.Translation(-sh)
    spine.matrix = spine_m @ spine.bone.matrix_local
    pbs["neck"].rotation_quaternion = Euler(neck_rot, "XYZ").to_quaternion()
    pbs["head"].rotation_quaternion = Euler(head_rot, "XYZ").to_quaternion()
    bpy.context.view_layer.update()
    solved = {}
    for leg, (wy, wz) in targets.items():
        up = pbs[f"leg_{leg[0]}{leg[1]}_upper"]
        lo = pbs[f"leg_{leg[0]}{leg[1]}_lower"]
        h3 = spine_m @ up.bone.head_local
        l1 = up.bone.length
        l2 = lo.bone.length
        knee, wrist = solve_two_bone((h3.y, h3.z), (wy, wz), l1, l2, leg[0] == "F")
        solved[leg] = (h3, knee, wrist)
        ru = up.bone.tail_local - up.bone.head_local
        a = yz_angle((knee[0] - h3.y, knee[1] - h3.z)) - yz_angle((ru.y, ru.z))
        pose_bone_to(up, Vector((h3.x, h3.y, h3.z)), a)
    bpy.context.view_layer.update()
    for leg, (h3, knee, wrist) in solved.items():
        lo = pbs[f"leg_{leg[0]}{leg[1]}_lower"]
        rl = lo.bone.tail_local - lo.bone.head_local
        a = yz_angle((wrist[0] - knee[0], wrist[1] - knee[1])) - yz_angle((rl.y, rl.z))
        pose_bone_to(lo, Vector((h3.x, knee[0], knee[1])), a)
    bpy.context.view_layer.update()
    for leg, (h3, knee, wrist) in solved.items():
        pw = pbs[f"leg_{leg[0]}{leg[1]}_paw"]
        pose_bone_to(pw, Vector((pw.bone.head_local.x, wrist[0], wrist[1])), 0.0)
    bpy.context.view_layer.update()


def key_frame(rig, frame, prev):
    for pb in rig.pose.bones:
        if pb.name == "root":
            continue
        q = pb.rotation_quaternion.copy()
        if pb.name in prev and prev[pb.name].dot(q) < 0:
            q.negate()
            pb.rotation_quaternion = q
        prev[pb.name] = q
        pb.keyframe_insert("location", frame=frame, group=pb.name)
        pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)


def author_action(rig, name, frames, pose_fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    prev = {}
    for f in range(frames + 1):
        pose_fn(f / frames)
        key_frame(rig, f, prev)
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = frames
    act.use_cyclic = True
    for fc in fcurves_of(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return act


def fcurves_of(act):
    if hasattr(act, "layers") and len(act.layers):
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out += list(cb.fcurves)
        return out
    return list(act.fcurves)


def walk_pose(rig):
    def fn(t):
        bob = -0.012 * (0.5 - 0.5 * math.cos(4 * math.pi * t))
        targets = {leg: walk_target(leg, off, c, t) for leg, off, c in LEGS}
        targets = {("F" if k[0] == "F" else "H", k[1]): v for k, v in targets.items()}
        nod = math.radians(2.5) * math.sin(4 * math.pi * t + 0.6)
        sway = math.radians(3.0) * math.sin(2 * math.pi * t)
        pose_frame(rig, (0, 0, bob), 0.0, (nod, 0, sway), (-0.6 * nod, 0, -0.5 * sway), targets)
    return fn


def idle_pose(rig):
    planted = {(leg[0], leg[1]): (c, PAW_Z) for leg, _, c in LEGS}

    def fn(t):
        w = 2 * math.pi * t
        breath = math.sin(2 * w)
        look = math.sin(w)
        pose_frame(
            rig,
            (0, 0, 0.006 * breath),
            math.radians(0.5) * breath,
            (math.radians(2.0) * math.sin(w + 1.1), 0, math.radians(4.0) * look),
            (math.radians(-2.5) * math.sin(w + 0.4), math.radians(2.0) * look, math.radians(5.0) * look),
            planted,
        )
    return fn


def rest_pose(rig):
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)


def author_animations(rig):
    scene = bpy.context.scene
    scene.render.fps = FPS
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    walk = author_action(rig, "Walk", WALK_FRAMES, walk_pose(rig))
    idle = author_action(rig, "Idle", IDLE_FRAMES, idle_pose(rig))
    rig.animation_data.action = None
    rest_pose(rig)
    for act in (walk, idle):
        track = rig.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, 0, act)
        strip.action_frame_start = 0
        strip.action_frame_end = act.frame_end
        track.mute = True
    scene.frame_start = 0
    scene.frame_end = WALK_FRAMES
    scene["strideLength"] = STRIDE_LENGTH
    scene["walkDuration"] = WALK_DURATION
    scene["walkSpeed"] = STRIDE_LENGTH / WALK_DURATION
    return walk, idle


def export_glb(rig, bear):
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bear.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_extras=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
        export_def_bones=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_normals=True,
        export_texcoords=False,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_copyright="CC0-1.0 Bjorn Hansen",
    )


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    mat = make_material()
    body = build_body()
    weight_body(body)
    details = build_details()
    body.data.materials.append(mat)
    details.data.materials.append(mat)
    bear = join([body, details], "Bear")
    for p in bear.data.polygons:
        p.use_smooth = False
    rig = build_armature()
    bear.parent = rig
    mod = bear.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    author_animations(rig)
    if len(bear.data.materials) > 1:
        bear.data.materials.clear()
        bear.data.materials.append(mat)
        for p in bear.data.polygons:
            p.material_index = 0
    bear.data["strideLength"] = STRIDE_LENGTH
    bear.data["walkDuration"] = WALK_DURATION
    bear["strideLength"] = STRIDE_LENGTH
    bear["walkDuration"] = WALK_DURATION
    rig["strideLength"] = STRIDE_LENGTH
    rig["walkDuration"] = WALK_DURATION
    bpy.context.scene["author"] = "Bjorn Hansen"
    bpy.context.scene["license"] = "CC0-1.0"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
    export_glb(rig, bear)
    print("bear tris", tri_count(bear.data), "verts", len(bear.data.vertices), "bones", len(rig.data.bones))


main()
