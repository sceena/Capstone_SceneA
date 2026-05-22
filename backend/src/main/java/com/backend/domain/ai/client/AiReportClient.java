package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.request.AiReportRequest;
import com.backend.domain.ai.dto.response.AiReportResponse;

public interface AiReportClient {

    AiReportResponse generateReport(AiReportRequest request);
}
