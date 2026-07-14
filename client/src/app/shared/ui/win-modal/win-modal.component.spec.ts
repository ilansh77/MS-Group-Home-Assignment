import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import {
  WinModalComponent,
} from './win-modal.component';

describe('WinModalComponent', () => {
  let fixture:
    ComponentFixture<
      WinModalComponent
    >;

  let component:
    WinModalComponent;

  beforeEach(async () => {
    await TestBed
      .configureTestingModule({
        imports: [
          WinModalComponent,
        ],
      })
      .compileComponents();

    fixture =
      TestBed.createComponent(
        WinModalComponent,
      );

    fixture.componentRef.setInput(
      'reward',
      10,
    );

    component =
      fixture.componentInstance;

    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the reward', () => {
    expect(
      fixture.nativeElement
        .textContent,
    ).toContain('10');
  });

  it('emits when closed', () => {
    let emitted = false;

    component.closed
      .subscribe(() => {
        emitted = true;
      });

    component.close();

    expect(emitted).toBeTrue();
  });

  it('prevents panel clicks from closing the modal', () => {
    const event =
      jasmine.createSpyObj<
        MouseEvent
      >(
        'MouseEvent',
        [
          'stopPropagation',
        ],
      );

    component.keepOpen(event);

    expect(
      event.stopPropagation,
    ).toHaveBeenCalledTimes(1);
  });
});