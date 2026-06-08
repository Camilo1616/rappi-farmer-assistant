package com.rappi.farmer.application.dtos;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ImportResultDto {
    private int total;
    private int created;
    private int updated;
    private int skipped;
    private int errors;
    private int removed;

    private List<StoreResultRow> createdList  = new ArrayList<>();
    private List<StoreResultRow> updatedList  = new ArrayList<>();
    private List<StoreResultRow> skippedList  = new ArrayList<>();
    private List<ErrorRow>       errorList    = new ArrayList<>();
    private List<StoreResultRow> removedList  = new ArrayList<>();

    public ImportResultDto() {}

    @Data
    public static class StoreResultRow {
        private final String storeCode;
        private final String storeName;
        private final String farmerEmail;
        private final String channel;
    }

    @Data
    public static class ErrorRow {
        private final String storeCode;
        private final String reason;
    }
}
