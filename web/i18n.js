/* UI localization only. Never translates project values, prompts or editable content. */
(()=>{
 const pairs=`
全部折叠|Collapse all
全部展开|Expand all
管理快捷预设|Manage text presets
我的快捷预设|My text presets
生成配置与参考素材|Generation and references
片段基本信息|Segment basics
镜头时间|Shot timing
本片段素材与管理|Segment references and management
创作工具|Creation tools
快捷预设|Text presets
自定义快捷预设|Custom text preset
保存快捷预设|Save text preset
保存预设修改|Save preset changes
取消编辑|Cancel editing
绑定为快捷标签|Bind as shortcut
已绑定|Bound
前移|Move up
后移|Move down
移除|Remove
插入内容|Insert text
不设置|Not assigned
绑定参考|Linked reference
全部分类|All categories
绑定使用库中最新文字说明，不添加媒体；素材编号请按当前片段核对。快捷键 Alt+Shift+1–9 在对应编辑字段内使用。|Bindings insert the latest library text without adding media. Check reference numbers against this segment. Use Alt+Shift+1–9 within the matching field.
快捷预设独立保存；插入后按原有流程保存项目|Presets are saved separately; inserted text uses the normal project save flow.
快捷预设读取中…|Loading text presets…
已插入快捷预设 · 按原有流程保存|Preset inserted; save through the normal workflow.

浮动节点编辑|Floating node editor
节点编辑|Node editor
上一镜|Previous shot
下一镜|Next shot
右侧编辑|Dock to Inspector
关闭编辑面板|Close editor
编辑方式 · 浮动|Editor · Floating
编辑方式 · 右侧|Editor · Inspector
画布设置|Canvas settings
摄影机快捷预设|Camera presets
对齐下一镜开始时间|Align next shot start
下一镜当前从|Next shot starts at
开始须小于结束，且不能超出本段|Start must precede end within segment duration
当前结束已达到下一镜末尾，无法对齐|Current end reaches the next shot end; cannot align
输入 @ 选择本片段素材；↑ ↓ 选择，Enter 插入，Esc 关闭。|Type @ for segment assets; ↑ ↓ to select, Enter to insert, Esc to close.
缓慢推近|Slow push-in
绕圈环拍|Orbit
极速俯冲|Fast dive
POV 视角|POV

收起右侧面板|Collapse Inspector
展开右侧面板|Expand Inspector
AI 帮忙修改 · 预览 / 对比|AI repair · Preview / Compare
确认应用修改|Confirm and apply changes
修改前 / 修改后对比|Before / After comparison
修改前|Before
修改后|After
本镜头内容未改变|This shot is unchanged
当前项目尚未修改|The current project is unchanged
整篇剧情规划|Whole-story planning
整篇规划|Plan whole story
写作技能库|Writing skills library
写作技能|Writing skills
本段对白语言|Segment dialogue language
对白语言 · 当前片段|Dialogue language · Current segment
本段默认对白语言|Segment default dialogue language
AI 规划 · 先预览|AI planning · Preview first
确认追加片段|Confirm and append segments
复制最终提示词|Copy final prompt
编辑与生成|Edit and generate
展开与视图|View and navigation
管理与导出|Manage and export
危险操作|Danger zone
AI 分析|AI analysis
片段数量|Segment count
每段秒数|Seconds per segment
整体剧情|Whole story
整篇规划预览|Whole-story preview
应用选择|Apply selection
自定义规则|Custom rules
项目根节点|Project root node
根节点形状|Root node shape
圆形|Circle
圆角矩形|Rounded rectangle
方形|Square
菱形|Diamond
六边形|Hexagon
科技切角框|Chiseled frame
更多编辑|More editing
视图与选择|View and selection
布局与编组|Layout and grouping
复制本段提示词|Copy segment prompt
分镜工作台|Storyboard Workbench
检查更新|Check for updates
画布模式|Canvas
首页 / 示例|Home / Example
首页|Home
简洁模式|Simple mode
专业模式|Professional mode
新建项目|New project
创建新项目|Create a project
视觉参考库|Visual references
素材库 · 我的创作素材|Asset library · My creative assets
素材库|Asset library
任务中心|Task Center
创作意图|Creative intent
布局方案|Layout presets
布局|Layout
日间|Light
夜间|Dark
本机项目|Local projects
导入导演包|Import Director Pack
导出导演包|Export Director Pack
导出 H3 包|Export H3 Pack
导出|Export
AI 连接设置|AI connection settings
卸载 AI 模型|Unload AI models
先把故事讲清楚。|Start with a clear story.
再拍好每一个镜头。|Then plan every shot.
整理素材、规划分镜、记录成片。|Organize assets, plan shots and track finished videos.
从手动创作开始，随时加入 AI 辅助。|Start manually. Add AI assistance whenever you need it.
你想讲什么|What happens?
谁 · 在哪里|Who · Where
镜头怎么拍|How to film it
从这里开始 · 推荐|Start here · Recommended
体验示例项目|Explore the sample
开始自己的故事|Start your own story
继续已有创作|Continue your work
导入已有项目|Import a project
无需配置 · 可直接编辑|No setup · Ready to edit
手动创作也能完整使用|Fully usable without AI
沿用已有故事和素材|Keep your existing story and assets
找回旧项目|Recover older projects
刷新|Refresh
清空全部|Clear all
回收站|Trash
还没有项目，试试上方示例或新建。|No projects yet. Open the sample or create a project.
旧版导入过的项目，可点“找回旧项目”扫描最近备份。|Use “Recover older projects” to scan recent backups from older versions.
基础分镜无需连接 AI。首次使用 AI 功能时，再设置模型。|Basic storyboarding needs no AI. Set up a model when you first use an AI feature.
AI 与 H3 分别用来做什么？|What do AI and H3 do?
手动创作已就绪 · AI 可按需连接|Manual editing is ready · Connect AI when needed
任务队列空闲|Task queue idle
项目自动保存在当前电脑|Projects are saved on this computer
打开保存的项目或导演包，继续整理与修改。|Open a saved project or Director Pack to continue editing.
写下一个想法，逐步准备素材，再添加第一个镜头。|Write an idea, prepare your assets, then add your first shot.
创建第一个项目|Create your first project
项目名称|Project name
从故事开始，素材与镜头可以稍后添加。|Start with a story. Assets and shots can be added later.
当前项目会自动备份到本机。|The current project will be backed up locally.
创建并进入总览|Create and open canvas
打开入门示例|Open the sample project
备份并打开示例|Back up and open sample
继续编辑|Continue editing
打开总览|Open canvas
取消|Cancel
关闭|Close
保存设置|Save settings
保存修改|Save changes
立即保存|Save now
重新载入|Reload
保存 / 交接|Save / hand off
保存项目备份 / 交接|Save project backup / hand off
确认全部素材|Confirm all assets
详细编辑|Detailed editor
项目包|Project pack
工具|Tools
自由画布|Free canvas
卡片模式|Card mode
片段卡片|Segment cards
全部折叠|Collapse all
全部展开|Expand all
折叠|Collapse
展开|Expand
拖动整个片段|Drag entire segment
画布外观|Canvas appearance
编组|Group
解组|Ungroup
更多|More
收起镜头|Collapse shots
展开镜头|Expand shots
选择|Select
平移|Pan
拖空白框选|Drag empty space to select
拖空白平移|Drag empty space to pan
总览查询|Search canvas
搜索素材、片段或镜头…|Search assets, segments or shots…
查询|Search
缩小|Zoom out
放大|Zoom in
适应全部|Fit all
上传视频|Upload video
选片段写故事 → 选镜头编辑 → 上传本片段成片|Select a segment → Edit its shots → Upload the finished video
点节点编辑 · 拖空白框选 · 空格拖动平移 · 右键快捷操作|Click to edit · Drag to select · Space-drag to pan · Right-click for actions
选择节点后可直接修改。离开文字编辑或切换节点时自动保存。|Edit the selected node directly. Changes save when you leave a text field or switch nodes.
直接编辑|Edit directly
本段生成模式|Segment generation mode
项目生成配置|Project generation settings
生成模式与输入素材|Generation mode and inputs
生成模式|Generation mode
项目生成模式|Project generation mode
本段模式|Segment mode
本项目使用源视频时间线。|This project uses the source video's timeline.
源视频与项目模式|Source video and project mode
源视频|Source video
文生视频|Text to video
图生视频|Image to video
首尾帧|First / last frames
参考主体|Reference subjects
视频转视频|Video to video
参考素材改视频|Edit video with references
每段选择模式|Choose a mode per segment
逐段选择时使用 MIXED；其他片段保留原模式。|Per-segment mode selection uses MIXED; other segments keep their modes.
图片参考|Image references
音频参考|Audio references
视频参考|Video references
公共＋本组|Shared + segment
公共 + 本组|Shared + segment
本段参考素材|Segment reference assets
片段名称|Segment name
时长 / 秒|Duration / seconds
故事 / 剧本|Story / script
故事目标|Story goal
默认对白语言|Default dialogue language
镜头对白语言|Shot dialogue language
用于本项目对白，镜头单独指定语言时优先使用镜头设置。|Used for dialogue in this project. A shot's own language setting takes priority.
本段提示词|Segment prompt
可留空：先写故事，再用 AI 拆镜生成。清空此框不会删除已有镜头。|Optional: write the story first, then use AI shot planning. Clearing this field does not delete existing shots.
手动写提示词|Write a prompt manually
普通剧情请写在“故事 / 剧本”。此框需要时间线，例如 [0.00s–15.00s]，开始小于结束且不能超过本段时长。Camera / Dialogue / Sound 为可选字段。|Write plain story text in “Story / script”. This field requires a timeline, e.g. [0.00s–15.00s]. Start must be before end, and end cannot exceed the segment duration. Camera / Dialogue / Sound are optional.
插入手动模板|Insert manual template
模板按当前时长生成；插入后可编辑，保存时才应用。已有内容不会自动覆盖。|The template uses the current duration. Edit it before saving; existing text is never replaced automatically.
AI 拆镜|AI shot planning
手动添加镜头|Add shot manually
添加镜头|Add shot
新增片段|New segment
添加片段|Add segment
本片段素材|Segment assets
先添加人物、场景或道具素材。|Add character, location or prop assets first.
本组素材|Segment assets
公共素材|Shared assets
片段承接与摘要|Continuity and summary
文字拆镜继承上一段|Inherit previous segment for text planning
H3 视频段间引导继承上一段|Inherit previous segment for H3 video guidance
视频引导还受项目全局开关控制，效果由外部 H3 导演台实现。|Video guidance also depends on the project switch and is handled by the external H3 Director.
剧情摘要|Story summary
故事历史|Story history
复制整段|Duplicate segment
片段前移|Move segment earlier
片段后移|Move segment later
删除片段|Delete segment
撤销删除片段|Undo segment deletion
深度审查|Deep review
全局段间引导|Global segment guidance
查看、复制或直接修改最终提示词。修改后按时间区间保留已有镜头图片与编号，旧镜头可撤销。人物 / 场景定义由素材说明自动编译，请在素材节点修改。|View, copy or edit the final prompt. Matching time ranges retain shot images and IDs; shot changes can be undone. Character and location definitions are compiled from asset descriptions; edit them in the asset nodes.
正在读取最终输出…|Loading final output…
输出检查 · 请核对|Output check · Review required
输出检查 · 未发现提醒|Output check · No warnings found
输出检查 · 上次拆镜提醒|Output check · Last planning warnings
当前最终输出；可修改后保存|Current final output; edit and save if needed
复制提示词|Copy prompt
提示词历史|Prompt history
撤销镜头修改|Undo shot changes
开始 / 秒|Start / seconds
结束 / 秒|End / seconds
画面 / 动作|Visual / action
摄影机|Camera
对白|Dialogue
声音|Audio
表情 / 表演|Expression / performance
表演、声音与对白语言|Performance, sound and dialogue language
选镜头参考|Choose camera reference
选动作参考|Choose action reference
选表情参考|Choose expression reference
镜头起止空间状态|Shot start / end spatial states
起始位置 / 朝向 / 姿态|Starting position / direction / pose
结束位置 / 动作结果|Ending position / action result
下一镜头应承接结束状态；区分场景位置与画面左右。|The next shot should continue from the end state. Distinguish scene positions from screen left/right.
专业镜头参数|Advanced camera settings
上传 / 替换镜头图|Upload / replace shot image
镜头前移|Move shot earlier
镜头后移|Move shot later
删除镜头|Delete shot
素材名称|Asset name
素材类型|Asset type
素材用途类型|Asset role
素材用途|Asset scope
具体说明|Description
素材缺失|Missing asset
参考素材|Reference asset
确认使用我的说明|Confirm my description
AI 分析说明|Analyze description with AI
删除素材|Delete asset
AI 草稿 / 说明历史|AI drafts / description history
场景基准布局|Scene layout baseline
引用此素材的片段|Segments referencing this asset
选择素材替换|Choose replacement asset
拖入同类素材，替换此素材|Drop matching media to replace this asset
保留编号与现有引用|Keep its number and references
说明已确认|Description confirmed
说明未确认或已变化|Description unconfirmed or changed
替换图片或修改说明后需重新确认。|Confirm again after replacing the image or changing its description.
本片段成片|Segment output
最终提示词|Final prompt
视频记录|Video record
视频名称|Video name
模型、版本与记录|Model, version and notes
下载视频|Download video
删除视频记录|Delete video record
暂无备注|No notes
视频文件缺失。|Video file missing.
记录本片段已经生成的视频。文件与备注随导演包保存。|Track videos already generated for this segment. Files and notes are included in the Director Pack.
上传本片段视频|Upload segment video
拖入成片视频|Drop finished video
上传已有视频 · 非生成进度|Upload an existing video · Not generation progress
个视频版本 · 点击上传|video versions · Click to upload
机位未设置|Camera not set
尚未填写画面动作|No visual action yet
新建片段 / 写故事|Create segment / write story
添加公共素材|Add shared asset
添加手动镜头|Add manual shot
从一个片段开始|Start with a segment
先写故事，再添加人物与场景，最后编排镜头。|Write a story, add characters and locations, then plan the shots.
AI 拆镜按需使用，无需配置也可手动创作。|AI planning is optional. Manual editing needs no AI setup.
自己的人物、场景、道具、音视频与内容说明。|Your characters, locations, props, media and notes.
自己的角色、场景、道具、音视频与内容说明。分类和内容可自定义，跨项目保存；加入项目时复制文件，不改变库内原件。|Store your own characters, locations, props, media and notes. Customize categories and reuse them across projects. Adding to a project copies the file; the library original stays unchanged.
新增素材|New asset
管理分类|Manage categories
分类|Category
全部分类|All categories
搜索|Search
名称或内容|Name or notes
只看收藏|Favorites only
已删除|Deleted
加入项目的用途|Add to project as
公共参考 · 所有片段|Shared reference · All segments
本段参考|Segment reference
暂无符合条件的素材，可新增自己的素材。|No matching assets. Add your own to get started.
上一页|Previous page
下一页|Next page
文字素材|Text asset
已收藏|Favorited
收藏|Favorite
编辑素材|Edit asset
编辑|Edit
复制说明|Copy notes
加入参考|Add reference
删除|Delete
恢复|Restore
名称|Name
内容 / 说明|Content / notes
素材文件|Media file
返回素材库|Back to library
保存素材|Save asset
清除库条目的媒体（项目副本不受影响）|Remove library media (project copies are unaffected)
原媒体保留；选择新文件可替换|Keep existing media, or select a replacement file
也可先保存文字说明，添加媒体后再加入项目参考。|You can save notes first. Add media later to use this as a project reference.
自定义素材分类|Custom asset categories
已有分类|Existing category
新增分类|New category
分类名称 / 新名称|Category name / new name
重命名会同步该分类的条目；删除分类时条目移至“未分类”，不删除素材。|Renaming updates all items in the category. Deleting a category moves its items to Uncategorized; no assets are deleted.
删除分类|Delete category
保存分类|Save category
人物|Character
场景|Location
道具|Prop
风格|Style
视频|Video
未分类|Uncategorized
公共|Shared
本组|Segment
卡片模式与布局方案|Card mode and layout presets
已保存方案|Saved presets
当前项目选项|Current project options
方案名称|Preset name
显示模式|Display mode
素材位置|Asset position
镜头上方|Above shots
镜头左侧|Left of shots
每行镜头数|Shots per row
每行片段数|Segments per row
间距|Spacing
镜头宽度|Shot width
镜头高度|Shot height
素材宽度|Asset width
素材高度|Asset height
保存当前片段手动位置 / 尺寸（按素材、镜头顺序复用）|Capture this segment's positions / sizes (reuse by asset and shot order)
布局方案只保存排列选项，不携带素材与故事。新项目使用默认方案；已有项目不会自动重排。切换模式保留各自布局，套用方案前保留上一份布局。|Presets store layout options only, not assets or stories. New projects use the default preset; existing projects are not rearranged automatically. Each mode retains its own layout, and applying a preset keeps the previous layout for recovery.
删除自定义方案|Delete custom preset
设为新项目默认|Set as default for new projects
保存 / 另存方案|Save preset
另存为新方案|Save as new preset
应用到当前项目|Apply to current project
恢复上次布局|Restore previous layout
新项目默认|Default for new projects
字体、素材与连线|Text, assets and connections
即时预览，随项目自动保存。|Preview instantly. Saved with your project.
文字与素材|Text and assets
标题字号|Title font size
正文字号|Body font size
辅助字号|Caption font size
标题颜色|Title color
正文颜色|Body color
辅助颜色|Caption color
素材节点宽度|Asset node width
素材节点高度|Asset node height
选择一个素材节点后调整它的宽高；不会修改其他节点。|Select an asset node to adjust its dimensions. Other nodes are unchanged.
图片显示|Image display
完整显示 · 保持比例|Contain · Keep aspect ratio
填满 · 裁剪边缘|Cover · Crop edges
连线与箭头|Connections and arrows
走线形态|Line shape
原有默认|Original default
直角线|Right-angle line
直线|Straight line
曲线|Curve
隐藏连线|Hide connections
45°切角|45° chamfer
光效|Light effect
简洁实线|Plain solid line
流光粒子脉冲|Flowing particle pulse
双轨数据总线|Dual-rail data bus
霓虹光晕|Neon glow
主干 / 分支层级样式|Trunk / branch hierarchy
连线颜色|Line color
箭头颜色|Arrow color
箭头 / 端点|Arrow / terminal
双重 HUD 游标|Double HUD chevrons
三重 HUD 游标|Triple HUD chevrons
空心菱形|Hollow diamond
十字准星|Crosshair
斜切尖端|Chiseled tip
脉冲圆环|Pulse ring
实心三角|Filled triangle
空心箭头|Open arrow
圆点|Dot
无箭头|No arrow
层级样式开启时，主干使用 HUD 游标，素材分支使用菱形；关闭后统一使用所选端点。|With hierarchy enabled, trunks use HUD chevrons and asset branches use diamonds. Disable it to use the selected terminal everywhere.
流动速度|Flow speed
启用流动动画|Enable flow animation
显示焊盘与卡片接口|Show pins and card terminals
背景与高亮|Background and highlights
背景样式|Background pattern
背景|Background
节点|Node
高亮|Highlight
网格|Grid
点阵|Dots
方格|Grid lines
纯色|Solid
格子大小|Grid size
恢复默认外观|Reset appearance
拖动调整节点大小|Drag to resize node
调整右侧详情宽度|Resize Inspector
未指定 / 自定义|Unspecified / custom
未指定|Unspecified
景别|Shot size
机位|Camera angle
构图|Composition
光线|Lighting
色调|Palette
运镜|Camera movement
焦段|Focal length
景深|Depth of field
图示|Reference
图片查看|Image viewer
适应窗口|Fit window
关闭图片查看|Close image viewer
放大图片|Enlarged image
点击放大查看|Click to enlarge
分镜|Storyboard
镜头|Shot
片段|Segment
故事|Story
素材|Asset
设置|Settings
项目|Project
图片|Image
音频|Audio
首帧|First frame
尾帧|Last frame
秒|seconds
等待|Waiting
执行中|Running
完成|Done
失败|Failed
服务中断|Service interrupted
暂停队列|Pause queue
继续队列|Resume queue
清理已完成|Clear completed
重试|Retry
应用|Apply
预览|Preview
保存|Save
已保存在本机|Saved locally
有未保存修改|Unsaved changes
布局待保存|Layout pending save
布局已保存|Layout saved
正在保存并同步提示词…|Saving and syncing prompt…
已保存 · 与工作区共用同一项目|Saved · Shared with the main workspace
正在读取|Loading
读取失败|Failed to load
保存失败|Save failed
输入仍保留，可修正后重试。|Your input is preserved. Correct it and retry.
请先完成输入法选词，再保存。|Finish composing text before saving.
输入框内保留文字编辑快捷键。节点位置只影响总览布局。|Text fields retain editing shortcuts. Node positions only affect canvas layout.
全选当前可见节点|Select all visible nodes
保存当前修改|Save current changes
撤销移动、缩放、编组或批量删除|Undo move, resize, group or bulk deletion
总览操作|Canvas controls
知道了|Got it
当前素材|Selected asset
动效 · 开|Animation · On
动效 · 关|Animation · Off
动效|Animation
开|On
关|Off
查找|Find
导入整合包|Import reference pack
导出整合包|Export reference pack
新增参考|New reference
修改 / 替换参考|Edit / replace reference
恢复 / 隐藏|Restore / hide
内置示意|Built-in illustration
应用景别|Apply shot size
应用机位|Apply camera angle
应用动作|Apply action
应用表情|Apply expression
只看已添加的图片 / 动图 / 视频|Only show added images / GIFs / videos
显示隐藏的内置条目|Show hidden built-in entries
不设媒体容量上限|No media storage quota
同文件去重计量|Duplicate files counted once
媒体容量|Media storage
`
 const extra=`
AI 辅助可选。选择本地 Ollama 或兼容 API，配置一次后保存在本机。|AI assistance is optional. Choose local Ollama or a compatible API. Settings are saved locally.
连接方式|Connection method
本地 Ollama|Local Ollama
兼容 API|Compatible API
服务地址|Server URL
拆镜 / 审查文字模型|Text model for shot planning / review
填写完整模型名称|Enter the full model name
读取 Ollama 模型|List Ollama models
本地 Ollama 一般无需填写|Usually not required for local Ollama
视觉模型与高级参数|Vision model and advanced settings
素材 / 反推视觉模型（需要支持图片）|Vision model for assets / reverse prompting (image input required)
留空时沿用文字模型，需确认它能看图|Leave blank to use the text model; ensure it supports images
素材分析输出上限 / tokens|Asset analysis output limit / tokens
文字生成输出上限 / tokens|Text generation output limit / tokens
思考模式|Reasoning mode
快速：支持时关闭或使用低等级|Fast: off or low when supported
指定关闭思考（需模型支持）|Reasoning off (model support required)
指定低等级（需模型支持）|Low reasoning (model support required)
沿用模型默认|Use model default
切换模型或整项任务结束后自动卸载 Ollama 模型|Unload Ollama models after switching models or completing a task
字段修改后自动保存。基础分镜可手动完成；AI 分析需视觉模型，已确认素材说明可供后续文字拆镜复用。|Fields save automatically. Basic storyboarding can be done manually. AI asset analysis needs a vision model; confirmed descriptions can be reused for text-based shot planning.
先手动编辑|Edit manually first
测试连接|Test connection
保存并继续|Save and continue
保存并关闭|Save and close
正在测试连接…|Testing connection…
AI 已验证连接|AI connection verified
连接失败|Connection failed
工作台正在加载，请稍候|Workbench loading; please wait
请刷新重试。|Refresh and try again.
按你的需要，逐步开始|Get started at your own pace
基础分镜 · 无需模型|Basic storyboarding · No model required
写故事、整理素材、手动编辑镜头、查看提示词和记录成片。|Write stories, organize assets, edit shots manually, view prompts and track finished videos.
AI 辅助 · 可选|AI assistance · Optional
拆镜、素材分析、深度审查和反推。需要本地 Ollama 或兼容 API，二选一。|Shot planning, asset analysis, deep review and reverse prompting. Requires local Ollama or a compatible API.
H3 视频交接 · 可选|H3 video handoff · Optional
导出的导演包交给 AI 搅拌手（AIMixer）H3 导演台。需另行安装 ComfyUI 节点、对应工作流与模型。工作台负责策划与记录，视频在外部工具生成。|Send exported Director Packs to AIMixer H3 Director. Install the ComfyUI nodes, workflow and models separately. FRAME plans and records your work; videos are generated externally.
打开「赛博修仙 v5」，体验完整故事、参考素材、分镜与已有成片。|Open “Cyber Cultivation v5” to explore the story, reference assets, shots and an existing video.
赛博修仙 v5 · 完整项目示例|Cyber Cultivation v5 · Complete sample project
从故事到分镜|From story to storyboard
先写清楚：谁、在哪里、发生了什么。现在不需要连接模型。|Describe who, where and what happens. No model connection is needed yet.
拖入角色、场景或道具，填写具体说明。人工确认即可继续。|Drop character, location or prop assets and add descriptions. Confirm them manually to continue.
添加镜头，点选后编辑动作、摄影机与对白。AI 拆镜是可选辅助。|Add shots and edit action, camera and dialogue. AI planning is optional.
本机项目回收站|Local project trash
删除的项目与媒体仍保留。恢复后回到首页列表选择项目继续编辑。|Deleted projects and media are retained. Restore a project, then select it from the home page to continue.
回收站为空。|Trash is empty.
删除本机项目|Delete local project
清空全部本机项目|Clear all local projects
全部移入回收站|Move all to trash
移入回收站|Move to trash
项目媒体保留用于恢复；参考库、AI 设置和原始导入文件不受影响。|Project media is retained for recovery. Reference libraries, AI settings and original imported files are unaffected.
写下故事，或导入已有 H3 导演包。|Write a story or import an H3 Director Pack.
本片段故事历史|Segment story history
AI 拆镜尚未提交|AI planning has not been submitted
查看拆镜任务 / 预览|View planning task / preview
对白语言 · 项目默认|Dialogue language · Project default
新增台词 / 视频对白语言|Language for new lines / video dialogue
未指定 · 按原台词|Unspecified · Keep original dialogue
可选择或自定义。镜头可单独指定；已有台词不自动翻译。|Choose or enter a language. Individual shots can override it; existing lines are not translated.
拖动 ⠿ 调整顺序，或用 ↑ ↓ 微调|Drag ⠿ to reorder, or use ↑ ↓
拖入图片素材|Drop image assets
或点击选择 · 支持多张|Or click to select multiple files
素材维护 / 修复|Asset maintenance / repair
显示 / 隐藏已删除素材|Show / hide deleted assets
修复包内图片|Repair packaged images
修复旧引用|Repair old references
AI 分析素材说明|Analyze asset descriptions with AI
先确认素材说明；之后文字拆镜不看图。|Confirm asset descriptions first; text planning does not inspect images.
工作流|Workflow
策划 · 分镜 · 素材 · H3|Planning · Shots · Assets · H3
提示词反推|Reverse prompting
AI 镜头解析|AI shot analysis
片段设置|Segment settings
清空镜头|Clear shots
撤销镜头替换 / 清空|Undo shot replacement / clearing
段间引导|Segment guidance
分镜画面|Shot board
素材与连续性审查|Assets and continuity review
H3 提示词历史|H3 prompt history
深度审查（可选）|Deep review (optional)
图片 / 视频提示词反推|Image / video reverse prompting
视觉模型分析 · 可自定义模板|Vision model analysis · Customizable templates
拖入图片或视频 · 点击选择文件|Drop an image or video · Click to choose a file
也可从下方选择工作台素材或镜头图片|Or select a workbench asset or shot image below
工作台素材|Project assets
选择图片 / 视频|Choose image / video
视觉模型|Vision model
填写支持图片输入的模型名称|Enter a model that supports image input
请选择图片或视频|Choose an image or video
视频采样帧数|Video sample frame count
建议从 8 帧开始；采样可能遗漏短镜头，长视频请分段。支持本机浏览器能够播放的视频格式。|Start with 8 frames. Sampling may miss brief shots; split long videos. Supported formats depend on your browser.
反推模板|Reverse prompt template
新增模板|New template
修改 / 保存模板|Edit / save template
删除模板|Delete template
查看 / 临时编辑反推提示词|View / temporarily edit reverse prompt instructions
选择模板或填写自定义反推要求|Choose a template or enter custom instructions
此处临时编辑只用于本次任务；点击修改 / 保存模板才能永久保存。|Temporary edits apply only to this task. Use Edit / save template to keep them permanently.
本次补充要求|Additional instructions for this task
例如：关注人物服装与光影，忽略画面内文字|E.g. focus on clothing and lighting; ignore text in the image
音频记录（可选）|Audio notes (optional)
当前通过视频采样帧分析画面，视觉接口没有读取音轨。可播放视频核对后，在下方提供台词、BGM 或音效记录；未提供时结果会注明音频未分析。|Visual analysis uses sampled frames and does not read the audio track. After listening, add dialogue, music or sound notes below. Otherwise the result states that audio was not analyzed.
粘贴已确认的台词 / 音频记录，不要根据画面猜测|Paste verified dialogue / audio notes; do not infer them from images
开始反推|Start reverse prompting
查看任务 / 历史|View tasks / history
反推结果|Reverse prompt result
复制结果|Copy result
导出 Markdown|Export Markdown
原始提示词 / Markdown|Raw prompt / Markdown
这里只显示当前片段的专属素材；左边公共素材自动供所有片段使用。|Only this segment's assets appear here. Shared assets on the left are available to all segments.
从其他片段复制素材|Copy assets from another segment
本组全部改为公共|Make all segment assets shared
拖入图片新增本组素材 · 拖到已有卡片上直接替换|Drop images to add segment assets · Drop onto a card to replace it
本片段视频记录|Segment video records
保存已经生成的视频。文件和备注随导演包导出；复制片段不会复制视频记录。|Save already-generated videos. Files and notes are exported in Director Packs; duplicating a segment does not duplicate its video records.
拖入视频 · 点击添加（MP4 / WebM / MOV，单个上限 50MB）|Drop video · Click to add (MP4 / WebM / MOV, up to 50MB each)
节奏时间线|Timing timeline
导演助手|Director assistant
调整当前片段，先预览再应用|Adjust the current segment; preview before applying
例如：节奏太快，减少到四个镜头，最后留三秒对视|E.g. reduce to four shots and end with a three-second exchange of looks
调整分镜|Adjust shots
选择一个镜头|Select a shot
编辑动作、摄影机和表演|Edit action, camera and performance
图示参考|Visual reference
查看全部镜头图示|Browse camera references
解析这个镜头|Analyze this shot
对白语言 · 当前镜头|Dialogue language · Current shot
单独指定语言|Override language
留空 · 沿用项目默认|Leave blank to use project default
只约束对白语言，不自动翻译台词；不保证所有视频模型均支持。|Controls dialogue language without translating lines. Support varies by video model.
默认无对白，旁白后期 TTS|No dialogue by default; add narration with TTS later
环境音 / 动作音|Ambient / action sounds
连续性锁定|Continuity locks
场景位置与屏幕左右分别描述；下一镜头应承接此结束状态。|Describe scene positions separately from screen left/right. Continue from this end state in the next shot.
上传图片|Upload image
前移|Move earlier
后移|Move later
身份|Identity
服装|Clothing
查看|View
替换|Replace
锁定|Lock
恢复素材|Restore asset
拖同类素材到此卡片即可替换|Drop matching media onto this card to replace it
确认说明|Confirm description
音频 / 视频可填写说明并人工确认。|Add descriptions for audio / video and confirm them manually.
隐藏缺失素材|Hide missing assets
显示缺失素材|Show missing assets
公共人物、场景或道具放在这里，切换片段后仍可使用。|Shared characters, locations and props stay available across segments.
本组暂无专属素材。可从上一段复制，或使用左边的公共素材。|No segment-specific assets yet. Copy from another segment or use shared assets.
具体说明：外貌、衣服、场景、需要保持的细节…|Describe appearance, clothing, location and details to preserve…
没有匹配的素材，请先上传素材。|No matching assets. Upload an asset first.
没有可撤销的画布操作|No canvas action to undo
恢复默认布局|Reset layout
浏览器全屏|Browser fullscreen
窗口 / 铺满|Window / maximize
查找没有视频的片段|Find segments without videos
查找未确认素材|Find unconfirmed assets
重置布局|Reset layout
请选择有效画幅|Choose a valid aspect ratio
请填写项目名称|Enter a project name
请填写片段名称|Enter a segment name
请填写素材名称|Enter an asset name
项目已切换|Project changed
文件读取失败|Failed to read file
文件缺失|File missing
未保存|Unsaved
当前项目|Current project
本段时间线已满。新增镜头将均分本段时长，保留镜头内容和修改前历史，继续吗？|This segment's timeline is full. Adding a shot will divide the duration evenly, retaining shot content and a history snapshot. Continue?
插入模板会替换此框尚未保存的文字，继续吗？|Inserting a template replaces the unsaved text in this field. Continue?
请先填写有效的片段时长|Enter a valid segment duration first
已撤销节点移动|Node move undone
确定|Confirm
复制|Copy
关闭菜单 / 取消选择|Close menu / clear selection
全选可见节点|Select all visible nodes
取消选择|Clear selection
编辑所选节点|Edit selected node
删除镜头 / 片段|Delete shots / segments
将所选节点编组|Group selected nodes
解除所选布局组|Ungroup selected layout group
人工确认全部素材|Confirm all assets manually
拖动整组；双击修改组名|Drag group; double-click to rename
拖节点右下角|Drag node's bottom-right corner
调整节点大小|Resize node
空格 + 拖动 / 中键|Space-drag / middle mouse
缩放画布|Zoom canvas
确认后删除镜头 / 片段|Delete shots / segments after confirmation
编组 / 解组|Group / ungroup
`;
 const chrome=`
可编辑导演画布|Editable director canvas
常用入口|Quick access
属性面板|Inspector
可拖动缩放的导演画布|Draggable, zoomable director canvas
快捷键帮助|Keyboard shortcuts
选中多个节点后建立布局组|Select multiple nodes to create a layout group
切换日间 / 夜间主题|Toggle light / dark theme
故事、素材、分镜创作流程|Story, assets and storyboard workflow
已保存|Saved
本片段 Picture|Segment Picture
视频版本|Video versions
条历史|history entries
未填写说明|No description
暂无内容说明|No notes yet
待处理|Pending
待保存…|Unsaved changes…
空白项目已创建|Blank project created
上一项目已自动备份|Previous project backed up automatically
项目已保存在本机|Project saved locally
示例已就绪，可直接编辑|Sample ready to edit
尚未填写画面动作|No visual action yet
队列|Queue
任务|Task
当前|Current
布局组|Layout group
未确认素材|Unconfirmed assets
没有视频|No videos
确认|Confirm
`;
 const messages=`
串行执行 · 同时 1 个任务|Serial queue · One task at a time
串行执行|Serial execution
清理完成任务|Clear completed tasks
一键清理完成任务|Clear completed tasks
全部任务|All tasks
中断|Interrupted
显示各项目任务。暂停只停止领取后续任务。执行中的远端请求可能继续运行；拆镜和解析结果须预览确认后应用。总耗时含排队等待；执行耗时从开始运行计算。清理完成任务会删除完成记录及其未应用结果，项目素材、已应用分镜和故事历史保留。|Tasks from all projects are shown here. Pausing stops new tasks from starting; remote requests already running may continue. Preview planning and analysis results before applying them. Total time includes queue waiting; execution time starts when a task runs. Clearing completed tasks removes their records and unapplied results, while retaining project assets, applied shots and story history.
没有符合条件的任务。|No matching tasks.
队列已暂停；当前任务继续执行|Queue paused; the current task continues
查看任务|View task
跳转到工作台|Go to workbench
查看结果|View result
取消排队|Cancel queued task
停止跟踪|Stop tracking
重新解析已有输出|Reparse saved output
重新推理|Regenerate
旧生成模块已移除，记录仅供查阅|Legacy generation module removed; records are read-only
删除记录|Delete record
每一步耗时|Time per stage
总耗时|Total time
执行|Execution
开始|Started
等待执行|Waiting to start
未记录|Not recorded
尚未完成|Not finished
已请求停止|Stop requested
正在读取本机项目…|Loading local projects…
未找到有效时间线。请使用“插入手动模板”，或添加|No valid timeline found. Use “Insert manual template”, or add
后填写画面动作；普通剧情写在故事框|followed by a visual action. Put plain story text in the story field.
的时间区间无效或超过本段|has an invalid time range or exceeds this segment's duration of
请修改时间线|Please correct the timeline
按 ComfyUI 导演台格式保存。参考素材、首尾帧和源视频分别指定；成片记录只用于回看。|Saved in ComfyUI Director format. Specify reference assets, first/last frames and source video separately; output records are only for review.
V2V / RV2V 使用完整源视频的时间线；导入过的裁剪信息会保留。新增源视频时默认从开头开始。|V2V / RV2V use the source video's timeline. Imported trim information is retained; new source videos start from the beginning by default.
I2V 输入图片|I2V input image
FL2V 首帧|FL2V first frame
FL2V 尾帧|FL2V last frame
素材从卡片添加。|Add assets from their cards.
双语提示词|Bilingual prompt
最终提示词 · 中英双语|Final prompt · Chinese / English
按需调用已配置的文字 AI。时间线、素材编号与对白原文保持不变；原文不会被翻译覆盖。翻译需人工核对。|Uses your configured text AI on demand. Timeline, reference numbers and spoken lines stay unchanged. The original is preserved. Review translated meaning manually.
原文或素材已改变，旧翻译仅供查看，请重新翻译。|The source or assets changed. Old translations are for reference only; translate again.
查看版本|View version
中文副本|Chinese copy
原文|Original
当前导演包导出语言|Director Pack export language
AI 生成中文与英文副本|Generate Chinese and English copies with AI
复制当前版本|Copy selected version
设为导演包导出语言|Use selected language for Director Pack
双语翻译预览|Bilingual translation preview
保存双语副本|Save bilingual copies
返回任务中心|Back to Task Center
保存副本后可查看、复制或选择导演包导出语言。不会覆盖原文或自动替换镜头；请核对翻译含义。|Save copies to view, copy or choose a Director Pack export language. Originals and shots are not overwritten. Review the translated meaning.
本段专属参考|Segment-specific reference
公共参考|Shared reference
`;
 const dict=Object.fromEntries((pairs+extra+chrome+messages).trim().split('\n').map(line=>{const i=line.indexOf('|');return [line.slice(0,i),line.slice(i+1)]}));
 let language='zh';try{language=localStorage.getItem('frame-ui-language')==='en'?'en':'zh'}catch{}
 const textSources=new WeakMap(),attrSources=new WeakMap();let running=false,scheduled=false;
 // User text and machine-readable values remain intact, even if they match a UI label.
 const protectedSelector='textarea,input,datalist,script,style,[contenteditable], [data-user-content],.mentionMirror,.canvasDetailHeading h2,[data-floating-title],.canvasProjectHeading h2,.localProjectCard b,.creatorAsset b,.creatorAsset p,.creatorAsset small,#startupResumeTitle,#segmentTitle,#professionalSummary,#viewerTitle,#prompt,#taskResult,.taskResult,.taskRowHead b,.taskRow>small,pre,code,.referenceCard,.shotbody p,#reverseRendered,#planningReviewNotes,.canvasSegmentLink,.generationSegment h3,#assetMentions span,.canvasEditableRefs small,#segments b';
 const keys=Object.keys(dict).filter(k=>k.length>1).sort((a,b)=>b.length-a.length),pattern=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
 function translate(text){if(language!=='en')return text;const trim=text.trim();if(dict[trim])return text.replace(trim,dict[trim]);return text.replace(/(\d+(?:\.\d+)?)(\s*)(?:个)?(片段|镜头|素材|视频(?!版本)|秒|条历史)/g,(_,n,space,unit)=>n+' '+({片段:'segments',镜头:'shots',素材:'assets',视频:'videos',秒:'s',条历史:'history entries'})[unit]).replace(pattern,key=>dict[key])}
 function apply(root=document.body){if(running||!root)return;running=true;try{
  const nav=document.querySelector('.canvasQuickNav');if(nav&&!nav.querySelector('[data-ui-language]'))nav.append(control());
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode()){const parent=node.parentElement;if(!parent||parent.closest(protectedSelector)||(parent.matches('.nodeLabel b')&&!parent.closest('.overviewNode.shot,.overviewNode.output')))continue;const prior=textSources.get(node),source=prior&&node.nodeValue===prior.applied?prior.source:node.nodeValue;if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.setAttribute('value',parent.value);const applied=translate(source);textSources.set(node,{source,applied});if(node.nodeValue!==applied)node.nodeValue=applied}
  for(const el of root.querySelectorAll('[title],[placeholder],[aria-label]')){if(el.closest('[data-user-content],.mentionMirror')||el.matches('textarea,input')&&!el.hasAttribute('placeholder')&&!el.hasAttribute('aria-label'))continue;const stored=attrSources.get(el)||{};for(const key of ['title','placeholder','aria-label']){if(!el.hasAttribute(key))continue;const value=el.getAttribute(key),prior=stored[key],source=prior&&value===prior.applied?prior.source:value,applied=translate(source);stored[key]={source,applied};if(applied!==value)el.setAttribute(key,applied)}attrSources.set(el,stored)}
  document.documentElement.lang=language==='en'?'en':'zh-CN';
 }finally{running=false}}
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;observer.disconnect();apply();observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']})})}
 const observer=new MutationObserver(schedule);
 function set(value){language=value==='en'?'en':'zh';for(const select of document.querySelectorAll('[data-ui-language]'))select.value=language;try{localStorage.setItem('frame-ui-language',language)}catch{}observer.disconnect();apply();observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']})}
 const control=()=>{const label=document.createElement('label');label.className='uiLanguageControl';label.innerHTML='<span>UI</span><select data-ui-language aria-label="Interface language"><option value="zh">中文</option><option value="en">English</option></select>';label.querySelector('select').value=language;return label};document.querySelector('header').append(control());
 for(const event of ['input','change'])document.addEventListener(event,e=>{if(e.target.matches('[data-ui-language]')){e.stopPropagation();set(e.target.value)}},true);
 const canvasObserver=new MutationObserver(()=>{const nav=document.querySelector('.canvasQuickNav');if(nav&&!nav.querySelector('[data-ui-language]'))nav.append(control())});canvasObserver.observe(document.body,{childList:true,subtree:true});
 const originalConfirm=window.confirm.bind(window);window.confirm=text=>originalConfirm(translate(String(text)));
 window.frameI18n={translate,set,apply,language:()=>language};set(language);
})();
