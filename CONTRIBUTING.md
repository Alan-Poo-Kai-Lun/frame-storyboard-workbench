# 反馈与协作

当前为公开源码 Beta，暂时保留代码权利。获得仓库访问权限不等同于获得商业分发许可。

提交问题时写清版本、操作步骤、预期与实际行为。截图先脱敏，不上传客户资料或 API Key。模型相关问题附模型名称、量化、文字/视觉能力与配置的输出上限。

修改前先开 Issue 说明目的；提交前运行 `python -m unittest discover -s tests -v` 和 `python tools/check_release.py`。运行产生的 data/、versions/、dist/ 不得提交。

每次发布更新 CHANGELOG.md 与 version.json。实际剪辑、模型调用及外部导演台兼容性需实机验证，自动检查不能替代。
