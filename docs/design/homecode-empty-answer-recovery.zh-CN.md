# HomeCode 空回答恢复

[English](homecode-empty-answer-recovery.md) | [简体中文](homecode-empty-answer-recovery.zh-CN.md)

## 问题

当提供方通过 SSE 返回 `type=final_answer_not_formed`、`code=empty_answer` 错误时，HomeCode 2.1.17 可能在成功读取文件后终止任务。即使 HTTP 传输成功且输出预算仍有余量，这也是语义失败。ACP 可能丢失结构化字段，历史重放也会忽略已保存的 `turn_result` 错误。

## 决策

仅识别这两个精确的结构化字段，包括 SDK 错误包装。只有已输出内容全部为推理且未取消时，才重试当前模型请求一次。保留请求历史和已完成的工具结果。不得重新启动会话提示、重复执行已完成的工具、把推理视为成功，或将此失败送入通用无效流重试循环。第二次失败必须明确显示。恢复成功后产生的新工具调用属于正常任务继续执行。

通过 ACP 和 `turn_result.error` 传递有长度限制的 `errorKind=final_answer_not_formed`、`code=empty_answer`。利用现有会话更新元数据扩展，在原始记录位置重放错误终态。将其规范化为与实时 `turn_error` 相同的 UI 错误，并按提示标识去重，防止刷新后在新内容之后追加第二份错误。成功和取消的终态不会显示为错误。现有后台任务的生命周期保持不变。

React provider 根据规范化后的 `source=turn_error` 保留终态错误，包括通过原始 `session_update` 传输的历史重放。仅检查原始事件类型会在渲染对话记录之前丢弃已恢复的错误。

单独部署的私有原生 Qwen 解析器必须识别专用结束 token，不受 Markdown 位置影响；保留单个根推理区间；在把提前采样到的 EOG 接受到采样器或 KV 状态之前完成恢复。正常最终 EOS 仍然有效。桥接边界继续使用类型化 reasoning/content，并保留现有输出余量。

## 验证与发布

通过已安装 CLI/runtime 和受控 OpenAI SSE 重现客户端失败，然后用同一测试环境验证构建后的 CLI。覆盖一次恢复成功、重复失败、取消、部分输出或工具调用、保留工具结果、ACP 类型化错误传递、冷启动历史恢复和重复消息。原生测试覆盖行内及代码围栏中的结束标记、普通 token 拼出的相似文本、提前 EOG、最终 EOS，以及采样器克隆和回滚。

构建并检查相关包的类型，运行针对性回归测试，审查完整差异。使用生产 runtime 打包 HomeCode 2.1.18，验证 runtime 哈希、完整应用的严格签名、DMG 完整性及挂载后的 runtime 启动。分别说明架构、实际最低系统版本、临时签名、公证状态，以及另一台 Mac 上的实际验收情况。先准备原生 runtime，仅在模型槽位空闲时通过现有 Windows 计划任务切换版本。
