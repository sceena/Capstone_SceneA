package com.backend.domain.videoCall.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record VideoTokenResponse(
        String token,
        @JsonProperty("room_name") String roomName,
        @JsonProperty("livekit_url") String livekitUrl
) {}
