# FRAME V3.16 Beta 1

本次更新集中改善导演画布的操作与交接流程，包含 V3.15 的多媒体素材和生成模式支持。

## 九项画布更新

1. **常驻属性面板**：右侧「片段 / 素材 / 设置」切换，字号、颜色、节点尺寸与连线外观直接调整。
2. **按位置拖入素材**：空白处添加公共参考；镜头 / 片段卡添加所属片段参考；素材卡同类替换；成片卡添加已有视频记录。当前选择不改变拖放归属。
3. **本段生成模式就地编辑**：T2V / I2V / FL2V / R2V、本段提示词及输入素材直接配置。逐段改变模式时转为 MIXED，其他片段保留原模式。V2V / RV2V 项目仍需明确指定源视频。
4. **对白语言更明显**：项目默认语言直接显示；新项目默认 24fps，隐藏帧率输入，导入项目保留原帧率。
5. **素材删除与恢复**：右键或侧栏删除前查看受影响片段与输入绑定；删除后在素材页恢复，媒体和编号保留。
6. **连线与端点风格**：PCB 45° 切角、焊盘、HUD 游标、菱形、准星、斜切与脉冲端点；支持流光、主干双轨、光晕、颜色、速度及关闭动效。
7. **自动保存与反馈**：停止输入后保存，显示待保存 / 保存中 / 已保存 / 失败；失败保留草稿，可重试，重新载入前确认放弃草稿。
8. **操作区精简**：突出导出，项目包和工具菜单归组，重复片段导航折叠。
9. **流程与空状态**：成片空卡支持拖入已有视频；最终提示词按所属片段命名，默认放在对应流程右侧。

图片随素材节点尺寸调整；参考音频、视频及成片记录可直接播放。保留编组、一键确认素材及导演包往返。不加入批量生成、BGM 音轨、负面词或 Seed 配置。

## 实际界面

![导演画布与本段生成模式](https://raw.githubusercontent.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/v3.16-beta.1/docs/assets/screenshots/director-canvas-v3.16.png)

![常驻设置面板](https://raw.githubusercontent.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/v3.16-beta.1/docs/assets/screenshots/canvas-settings-v3.16.png)

## 下载与更新

- `FRAME-Workbench-Windows-x64-v3.16-beta.1.exe`：Windows 单文件版，无需 Python。
- `FRAME-Storyboard-Workbench-v3.16-beta.1.zip`：源码运行 / 更新包。
- `SHA256SUMS.txt`：下载文件校验值。

先备份项目，再退出旧启动器并运行新版。EXE 沿用本机数据目录；源码更新与数据位置见 [安装说明](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/blob/v3.16-beta.1/docs/install-and-data.md)。不要同时运行多个版本编辑同一份数据。

## 验证范围

本地后端 34 项测试、前端 10 组交互检查、Windows EXE 隔离启动自检已通过。七种模式已使用实际 H3 导演台导入器核对包结构、输入和媒体读取，包含 MIXED 分段模式。此结果不代表 GPU 生成效果已验证；操作系统原生拖放与所有浏览器编解码组合仍需实际使用核对。

[新手教程](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/blob/v3.16-beta.1/docs/quick-start.md) · [H3 对接与验证范围](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/blob/v3.16-beta.1/docs/h3-director-compatibility.md) · [全部更新](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/blob/v3.16-beta.1/CHANGELOG.md)
