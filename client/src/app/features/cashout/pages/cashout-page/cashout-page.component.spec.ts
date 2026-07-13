import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashoutPageComponent } from './cashout-page.component';

describe('CashoutPageComponent', () => {
  let component: CashoutPageComponent;
  let fixture: ComponentFixture<CashoutPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashoutPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashoutPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
