# Lisa: local generative hearing education

Lisa generates responses in a browser worker. It does not use a paid inference API, a server-held AI key, or scripted substitutes for general questions. The model weights and browser runtimes download on first use and may be cached by the browser. Download bandwidth, device memory, browser cache eviction and performance still matter.

- WebGPU: Qwen3 0.6B, quantized MLC models, WebLLM 0.2.88.
- CPU fallback: ONNX Community Qwen2.5 0.5B Instruct, q4, Transformers.js 4.3.2, single-threaded WASM. No cross-origin isolation requirement.
- Runtime/model downloads: Hugging Face, MLC's model-library repository, and the ONNX Runtime CDN. Chat prompts are processed locally and are not sent to an inference provider. Chat is held in tab memory, is not written to Firestore, and is cleared when account identity changes.
- Context: short conversation history; locally selected ECHO, WHO, and NIDCD reference notes; optional current report summary without name, email or age. These notes are a bounded local retrieval system, not live web search. Source links identify supplied reference notes, not evidence of external browsing by Lisa.
- Controls: opt-in initial download, progress, cancellation, stream stop, clear conversation, explicit AI labels, and optional report context. Unsupported loading or inference failures show an error rather than a fabricated reply.
- Scope: hearing education and understanding relative screening responses. Direct personal diagnosis/classification requests receive a separately labelled deterministic screening-limit notice. No diagnosis, clinical validation, doctor connection, or individually prescribed safe volume is claimed.

Manual evaluation in the cloud browser confirmed the CPU model loaded and generated a streaming answer to “How can I protect my hearing?”. A report-diagnosis probe produced an ambiguous initial “Yes” followed by a limitation, motivating the explicit app-level scope guard. This is not a clinical or broad model-quality evaluation. The GPU path could not be executed in this test browser because it has no WebGPU adapter.

Reference notes checked 18 November 2026:

- https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-safe-listening
- https://www.nidcd.nih.gov/health/sudden-deafness
- ECHO's implemented screening protocol, report schema and model limitations.

Small local models can give incomplete or inaccurate answers. This implementation has no guarantee of clinical accuracy. Review and evaluate before use beyond an educational pilot.
