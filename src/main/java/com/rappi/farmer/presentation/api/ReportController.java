package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/daily")
    public ResponseEntity<Map<String, Object>> daily() {
        return ResponseEntity.ok(reportService.getDailyReport());
    }

    @GetMapping("/portfolio")
    public ResponseEntity<Map<String, Object>> portfolio() {
        return ResponseEntity.ok(reportService.getPortfolioReport());
    }
}
