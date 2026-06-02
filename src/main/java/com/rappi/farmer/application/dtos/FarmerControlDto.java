package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FarmerControlDto {
    private Long id;
    private String fullName;
    private String farmerCode;
    private String email;
    private String countryCode;
    private String accountStatus;
    private Long liderId;
    private String liderName;
    private long tiendasAsignadas;
}
